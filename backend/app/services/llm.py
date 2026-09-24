"""
LLM Service with Retry and Fallback Chain
Implements Roadmap 1.3: Agent retry with exponential backoff + LLM fallback chain
"""
import asyncio
import logging

try:
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover
    genai = None  # type: ignore
    types = None  # type: ignore
from app.config import settings
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Base exception for LLM-related errors"""
    pass


class LLMTimeoutError(LLMError):
    """Raised when LLM request times out"""
    pass


class LLMProviderError(LLMError):
    """Raised when a specific LLM provider fails"""
    pass


def _create_gemini_client():
    """Create a Gemini client using the supported google-genai SDK."""
    if genai is None or types is None:
        raise LLMProviderError("google-genai SDK is not installed")
    if settings.GOOGLE_CLOUD_PROJECT:
        return genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )
    if settings.GEMINI_API_KEY:
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    raise LLMProviderError("No Gemini/Vertex credentials configured")


def _create_vertex_client():
    """Create a Vertex AI client when project credentials are configured."""
    if genai is None or types is None:
        raise LLMProviderError("google-genai SDK is not installed")
    if not settings.GOOGLE_CLOUD_PROJECT:
        raise LLMProviderError("GOOGLE_CLOUD_PROJECT not configured")
    return genai.Client(
        vertexai=True,
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
    )


@retry(
    stop=stop_after_attempt(settings.LLM_MAX_RETRIES),
    wait=wait_exponential(
        multiplier=settings.LLM_RETRY_DELAY_SECONDS,
        min=settings.LLM_RETRY_DELAY_SECONDS,
        max=30
    ),
    retry=retry_if_exception_type((LLMTimeoutError, LLMProviderError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
async def call_llm_with_retry(
    prompt: str,
    model_name: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
    timeout: int | None = None
) -> str:
    """
    Call LLM with exponential backoff retry logic.

    Args:
        prompt: The prompt to send to the LLM
        model_name: Optional model override (defaults to settings.LLM_MODEL)
        temperature: Sampling temperature (0.0-1.0)
        max_tokens: Maximum tokens in response
        timeout: Request timeout in seconds (defaults to settings.LLM_TIMEOUT_SECONDS)

    Returns:
        str: LLM response text

    Raises:
        LLMError: If all retries fail
    """
    model_name = model_name or settings.LLM_MODEL
    timeout = timeout or settings.LLM_TIMEOUT_SECONDS

    try:
        client = _create_gemini_client()

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    client.models.generate_content,
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                    )
                ),
                timeout=timeout
            )
        except Exception as initial_err:
            # Handle model deprecation/404 by attempting gemini-1.5-flash
            if ("NOT_FOUND" in str(initial_err) or "404" in str(initial_err)) and model_name != "gemini-1.5-flash":
                logger.warning(f"Gemini model {model_name} not found. Retrying with gemini-1.5-flash...")
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model="gemini-1.5-flash",
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=temperature,
                            max_output_tokens=max_tokens,
                        )
                    ),
                    timeout=timeout
                )
            else:
                raise initial_err

        if not response or not response.text:
            raise LLMProviderError(f"Empty response from {model_name}")

        return response.text.strip()

    except TimeoutError:
        logger.warning(f"LLM request to {model_name} timed out after {timeout}s")
        raise LLMTimeoutError(f"Request timed out after {timeout}s")

    except Exception as e:
        logger.error(f"LLM provider error with {model_name}: {e}")
        raise LLMProviderError(f"Provider error: {e}") from e


async def call_groq(
    prompt: str,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
    timeout: int = 30,
) -> str:
    """
    Call Groq API for ultra-low latency LLM inference.
    Complements Gemini with sub-500ms response times and failover protection.
    """
    if not settings.GROQ_API_KEY:
        raise LLMProviderError("GROQ_API_KEY is not configured")

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        chosen_model = model or settings.GROQ_MODEL
        completion = await asyncio.wait_for(
            client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=chosen_model,
                temperature=temperature,
                max_tokens=max_tokens,
            ),
            timeout=timeout,
        )
        if not completion.choices or not completion.choices[0].message.content:
            raise LLMProviderError(f"Empty response from Groq ({chosen_model})")
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Groq API error: {e}")
        raise LLMProviderError(f"Groq error: {e}") from e


async def call_llm_with_fallback(
    prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> tuple[str, str]:
    """
    Call LLM with enterprise multi-provider fallback chain:
    Primary (Gemini 3.6-flash) → High-Speed Secondary (Groq) → Tertiary (Ollama) → Offline Heuristic.

    Returns:
        tuple[str, str]: (response_text, provider_used)
    """
    errors = []

    # 1. Preferred Provider: Groq (if explicitly preferred)
    if settings.LLM_PREFERRED_PROVIDER == "groq" and settings.GROQ_API_KEY:
        try:
            logger.info(f"Attempting Groq LLM: {settings.GROQ_MODEL}")
            response = await call_groq(prompt=prompt, temperature=temperature, max_tokens=max_tokens)
            logger.info(f"✓ Groq succeeded: {settings.GROQ_MODEL}")
            return response, f"groq:{settings.GROQ_MODEL}"
        except Exception as e:
            logger.warning(f"✗ Groq failed: {e}")
            errors.append(f"Groq ({settings.GROQ_MODEL}): {e}")

    # 2. Preferred Provider: Local Ollama (if preferred)
    if settings.LLM_PREFERRED_PROVIDER == "local" and settings.LLM_FALLBACK_ENABLED:
        try:
            logger.info(f"Attempting local LLM fallback first: {settings.OLLAMA_MODEL}")
            response = await call_ollama(prompt=prompt, model=settings.OLLAMA_MODEL, temperature=temperature)
            logger.info(f"✓ Local LLM succeeded: {settings.OLLAMA_MODEL}")
            return response, f"local:{settings.OLLAMA_MODEL}"
        except Exception as e:
            logger.warning(f"✗ Local LLM failed: {e}")
            errors.append(f"Local ({settings.OLLAMA_MODEL}): {e}")

    # 3. Primary Provider: Google Gemini
    if settings.GEMINI_API_KEY or settings.GOOGLE_CLOUD_PROJECT:
        try:
            logger.info(f"Attempting primary Gemini LLM: {settings.LLM_MODEL}")
            response = await call_llm_with_retry(
                prompt=prompt,
                model_name=settings.LLM_MODEL,
                temperature=temperature,
                max_tokens=max_tokens
            )
            logger.info(f"✓ Primary Gemini succeeded: {settings.LLM_MODEL}")
            return response, f"primary:{settings.LLM_MODEL}"
        except Exception as e:
            logger.warning(f"✗ Primary Gemini failed: {e}")
            errors.append(f"Primary ({settings.LLM_MODEL}): {e}")

    # 4. Secondary Provider: Groq (Ultra-fast failover if Gemini fails or is unconfigured)
    if settings.LLM_FALLBACK_ENABLED and settings.GROQ_API_KEY and settings.LLM_PREFERRED_PROVIDER != "groq":
        try:
            logger.info(f"Attempting secondary Groq LLM: {settings.GROQ_MODEL}")
            response = await call_groq(prompt=prompt, temperature=temperature, max_tokens=max_tokens)
            logger.info(f"✓ Secondary Groq succeeded: {settings.GROQ_MODEL}")
            return response, f"secondary_groq:{settings.GROQ_MODEL}"
        except Exception as e:
            logger.warning(f"✗ Secondary Groq failed: {e}")
            errors.append(f"Secondary Groq ({settings.GROQ_MODEL}): {e}")

    # 5. Tertiary Provider: Local Ollama
    if settings.LLM_FALLBACK_ENABLED and settings.LLM_PREFERRED_PROVIDER != "local":
        try:
            logger.info(f"Attempting tertiary LLM (Ollama): {settings.OLLAMA_MODEL}")
            response = await call_ollama(prompt=prompt, model=settings.OLLAMA_MODEL, temperature=temperature)
            logger.info(f"✓ Tertiary LLM (Ollama) succeeded: {settings.OLLAMA_MODEL}")
            return response, f"tertiary:{settings.OLLAMA_MODEL}"
        except Exception as e:
            logger.warning(f"✗ Tertiary LLM (Ollama) failed: {e}")
            errors.append(f"Tertiary (Ollama {settings.OLLAMA_MODEL}): {e}")

    # 6. Quaternary: Offline deterministic mock fallback if configured
    if settings.LLM_OFFLINE_MOCK_FALLBACK:
        logger.warning("All LLM providers unavailable. Utilizing offline local extractive fallback.")
        return '{"summary": "Document processed offline.", "status": "processed_offline"}', "offline_fallback"

    # All providers failed
    error_summary = "; ".join(errors)
    logger.error(f"All LLM providers failed: {error_summary}")
    raise LLMError(f"All LLM providers exhausted: {error_summary}")


async def call_ollama(
    prompt: str,
    model: str,
    temperature: float = 0.2,
) -> str:
    """
    Call local Ollama instance as tertiary fallback.

    Args:
        prompt: The prompt to send
        model: Ollama model name (e.g., "llama3.1:8b")
        temperature: Sampling temperature

    Returns:
        str: Response text

    Raises:
        LLMProviderError: If Ollama call fails
    """
    import aiohttp

    url = f"{settings.OLLAMA_BASE_URL}/api/generate"

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
        }
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=90)) as resp:
                if resp.status != 200:
                    raise LLMProviderError(f"Ollama returned status {resp.status}")

                data = await resp.json()
                response_text = data.get("response", "").strip()

                if not response_text:
                    raise LLMProviderError("Empty response from Ollama")

                return response_text

    except TimeoutError:
        raise LLMProviderError("Ollama request timed out")
    except Exception as e:
        raise LLMProviderError(f"Ollama error: {e}") from e


async def get_cached_llm_response(prompt_hash: str) -> str | None:
    """Get cached LLM response from Redis if available"""
    from app.services.cache import cache_get
    cache_key = f"llm:cache:{prompt_hash}"
    return await cache_get(cache_key)


async def cache_llm_response(prompt_hash: str, response: str):
    """Cache LLM response in Redis with 1-hour TTL"""
    from app.services.cache import cache_set
    cache_key = f"llm:cache:{prompt_hash}"
    await cache_set(cache_key, response, ttl=3600)  # 1 hour


async def call_llm_cached(
    prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 2048,
    use_cache: bool = True
) -> tuple[str, str, bool]:
    """
    Call LLM with caching support.

    Returns:
        tuple[str, str, bool]: (response, provider, from_cache)
    """
    import hashlib

    # Generate cache key from prompt
    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]

    # Try cache first
    if use_cache:
        cached = await get_cached_llm_response(prompt_hash)
        if cached:
            logger.info(f"✓ Cache hit for prompt hash {prompt_hash}")
            return cached, "cache", True

    # Call LLM with fallback
    response, provider = await call_llm_with_fallback(
        prompt=prompt,
        temperature=temperature,
        max_tokens=max_tokens
    )

    # Cache the response
    if use_cache:
        await cache_llm_response(prompt_hash, response)

    return response, provider, False


def local_extractive_rag(question: str, docs: list) -> tuple[str, list[dict]]:
    """
    Offline local extractive RAG fallback.
    Delegates to the advanced LocalTfidfSearch engine.
    """
    from app.services.local_engine import LocalTfidfSearch
    return LocalTfidfSearch.extractive_qa(question, docs)

