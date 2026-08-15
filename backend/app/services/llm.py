"""
LLM Service with Retry and Fallback Chain
Implements Roadmap 1.3: Agent retry with exponential backoff + LLM fallback chain
"""
import asyncio
import logging
from typing import Any, Optional

import google.generativeai as genai
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from app.config import settings

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


def _configure_gemini():
    """Configure Google Gemini API"""
    if not settings.GEMINI_API_KEY:
        raise LLMProviderError("GEMINI_API_KEY not configured")
    genai.configure(api_key=settings.GEMINI_API_KEY)


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
    model_name: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
    timeout: Optional[int] = None
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
        # Configure Gemini
        _configure_gemini()
        
        # Create model
        model = genai.GenerativeModel(model_name)
        
        # Generate response with timeout
        response = await asyncio.wait_for(
            asyncio.to_thread(
                model.generate_content,
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
            ),
            timeout=timeout
        )
        
        if not response or not response.text:
            raise LLMProviderError(f"Empty response from {model_name}")
        
        return response.text.strip()
        
    except asyncio.TimeoutError:
        logger.warning(f"LLM request to {model_name} timed out after {timeout}s")
        raise LLMTimeoutError(f"Request timed out after {timeout}s")
    
    except Exception as e:
        logger.error(f"LLM provider error with {model_name}: {e}")
        raise LLMProviderError(f"Provider error: {e}") from e


async def call_llm_with_fallback(
    prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> tuple[str, str]:
    """
    Call LLM with full fallback chain: Primary → Secondary → Tertiary (Ollama).
    
    Implements Roadmap 1.3: LLM fallback chain
    
    Args:
        prompt: The prompt to send to the LLM
        temperature: Sampling temperature
        max_tokens: Maximum tokens in response
    
    Returns:
        tuple[str, str]: (response_text, provider_used)
        
    Raises:
        LLMError: If all providers in the chain fail
    """
    errors = []
    
    # Try Primary (Gemini)
    try:
        logger.info(f"Attempting primary LLM: {settings.LLM_MODEL}")
        response = await call_llm_with_retry(
            prompt=prompt,
            model_name=settings.LLM_MODEL,
            temperature=temperature,
            max_tokens=max_tokens
        )
        logger.info(f"✓ Primary LLM succeeded: {settings.LLM_MODEL}")
        return response, f"primary:{settings.LLM_MODEL}"
    except Exception as e:
        logger.warning(f"✗ Primary LLM failed: {e}")
        errors.append(f"Primary ({settings.LLM_MODEL}): {e}")
    
    # Try Secondary (if configured)
    if settings.LLM_FALLBACK_ENABLED and settings.LLM_SECONDARY_PROVIDER:
        try:
            logger.info(f"Attempting secondary LLM: {settings.LLM_SECONDARY_MODEL}")
            # Secondary provider logic would go here (OpenAI, Anthropic, etc.)
            # For now, we'll skip this and go to tertiary
            logger.warning("Secondary provider not implemented yet, skipping to tertiary")
        except Exception as e:
            logger.warning(f"✗ Secondary LLM failed: {e}")
            errors.append(f"Secondary ({settings.LLM_SECONDARY_MODEL}): {e}")
    
    # Try Tertiary (Local Ollama)
    if settings.LLM_FALLBACK_ENABLED:
        try:
            logger.info(f"Attempting tertiary LLM (Ollama): {settings.LLM_TERTIARY_MODEL}")
            response = await call_ollama(
                prompt=prompt,
                model=settings.LLM_TERTIARY_MODEL,
                temperature=temperature,
            )
            logger.info(f"✓ Tertiary LLM (Ollama) succeeded: {settings.LLM_TERTIARY_MODEL}")
            return response, f"tertiary:{settings.LLM_TERTIARY_MODEL}"
        except Exception as e:
            logger.error(f"✗ Tertiary LLM (Ollama) failed: {e}")
            errors.append(f"Tertiary (Ollama {settings.LLM_TERTIARY_MODEL}): {e}")
    
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
    
    url = f"{settings.LLM_TERTIARY_OLLAMA_URL}/api/generate"
    
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
                
    except asyncio.TimeoutError:
        raise LLMProviderError(f"Ollama request timed out")
    except Exception as e:
        raise LLMProviderError(f"Ollama error: {e}") from e


# Cache for LLM responses (Roadmap 1.3: Cache LLM responses in Redis)
# Key format: llm:cache:{hash(prompt)}
# TTL: 1 hour
async def get_cached_llm_response(prompt_hash: str) -> Optional[str]:
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

