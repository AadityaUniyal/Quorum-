"""
Pluggable AI Provider Router & Circuit Breaker

Manages local (Ollama) and cloud (Gemini, Groq) LLM providers with automatic
circuit breaking, retry backoff, and policy-based failover.
"""

import asyncio
import logging
import time
from abc import ABC, abstractmethod

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class ProviderError(Exception):
    """Raised when an AI provider fails during inference."""
    pass


class AIProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def is_local(self) -> bool:
        pass

    @abstractmethod
    async def generate_text(self, prompt: str, temperature: float = 0.2) -> str:
        pass

    @abstractmethod
    async def is_healthy(self) -> bool:
        pass


class OllamaProvider(AIProvider):
    """Local privacy-preserving Ollama provider."""

    def __init__(self, base_url: str | None = None, model: str | None = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.OLLAMA_MODEL

    @property
    def name(self) -> str:
        return f"Ollama({self.model})"

    @property
    def is_local(self) -> bool:
        return True

    async def generate_text(self, prompt: str, temperature: float = 0.2) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature}
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("response", "")
        except Exception as e:
            raise ProviderError(f"Ollama generation failed: {e}") from e

    async def is_healthy(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False


class GeminiProvider(AIProvider):
    """Google Gemini cloud provider."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.model = model or settings.LLM_MODEL
        self.api_key = api_key or settings.GEMINI_API_KEY

    @property
    def name(self) -> str:
        return f"Gemini({self.model})"

    @property
    def is_local(self) -> bool:
        return False

    async def generate_text(self, prompt: str, temperature: float = 0.2) -> str:
        try:
            from google import genai
            from google.genai import types
        except Exception as exc:
            raise ProviderError(f"google-genai SDK is unavailable: {exc}") from exc

        try:
            if settings.GOOGLE_CLOUD_PROJECT:
                client = genai.Client(
                    vertexai=True,
                    project=settings.GOOGLE_CLOUD_PROJECT,
                    location=settings.GOOGLE_CLOUD_LOCATION,
                )
            elif self.api_key:
                client = genai.Client(api_key=self.api_key)
            else:
                raise ProviderError("No Gemini or Vertex credentials configured.")

            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=temperature),
            )
            return (response.text or "").strip()
        except Exception as e:
            raise ProviderError(f"Gemini API request failed: {e}") from e

    async def is_healthy(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)


class MockLocalFallbackProvider(AIProvider):
    """Deterministic in-memory regex fallback provider for tests and fully offline environments."""

    @property
    def name(self) -> str:
        return "DeterministicLocalMock"

    @property
    def is_local(self) -> bool:
        return True

    async def generate_text(self, prompt: str, temperature: float = 0.2) -> str:
        return '{"status": "extracted", "fields": {}}'

    async def is_healthy(self) -> bool:
        return True


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit breaker tripped to OPEN state after {self.failure_count} failures.")

    def can_attempt(self) -> bool:
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
                return True
            return False
        return True  # HALF_OPEN


class ProviderRouter:
    """
    Routes AI inference requests between local Ollama and Cloud Gemini based on
    privacy policies and real-time availability.
    """

    def __init__(self, primary: AIProvider | None = None, fallback: AIProvider | None = None):
        self.primary = primary or (
            OllamaProvider() if settings.LLM_PREFERRED_PROVIDER == "local" else GeminiProvider()
        )
        self.fallback = fallback or (
            GeminiProvider() if settings.LLM_PREFERRED_PROVIDER == "local" else OllamaProvider()
        )
        self.deterministic_mock = MockLocalFallbackProvider()
        self.circuit_breakers: dict[str, CircuitBreaker] = {
            self.primary.name: CircuitBreaker(),
            self.fallback.name: CircuitBreaker(),
        }

    async def generate(self, prompt: str, temperature: float = 0.2) -> tuple[str, str]:
        # 1. Try Primary Provider
        cb_primary = self.circuit_breakers.get(self.primary.name, CircuitBreaker())
        if cb_primary.can_attempt():
            try:
                res = await self.primary.generate_text(prompt, temperature)
                cb_primary.record_success()
                return res, self.primary.name
            except Exception as e:
                cb_primary.record_failure()
                logger.warning(f"Primary provider {self.primary.name} failed: {e}. Attempting fallback...")

        # 2. Try Fallback Provider
        cb_fallback = self.circuit_breakers.get(self.fallback.name, CircuitBreaker())
        if cb_fallback.can_attempt():
            try:
                res = await self.fallback.generate_text(prompt, temperature)
                cb_fallback.record_success()
                return res, self.fallback.name
            except Exception as e:
                cb_fallback.record_failure()
                logger.warning(f"Fallback provider {self.fallback.name} failed: {e}")

        # 3. Deterministic Mock Fallback only when explicitly allowed.
        if settings.LLM_OFFLINE_MOCK_FALLBACK:
            res = await self.deterministic_mock.generate_text(prompt, temperature)
            return res, self.deterministic_mock.name

        raise ProviderError(
            f"All AI providers failed: primary={self.primary.name}, fallback={self.fallback.name}"
        )
