"""config.py — profile-driven, provider-agnostic LLM config.

LLM_PROFILE is the master switch. Adding a provider is one dict entry below.
Mirrors the pattern from braindb and the agent-spec.
"""
import logging
import os
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


# Adding a provider = one dict entry. No code change elsewhere.
_LLM_PROFILES: dict[str, dict[str, str]] = {
    "gemini": {
        "model": "gemini/gemini-3.1-flash-lite-preview",
        "api_key_env": "GEMINI_API_KEY",
        "api_base_env": "",
    },
    "deepinfra": {
        "model": "deepinfra/google/gemma-4-31B-it",
        "api_key_env": "DEEPINFRA_API_KEY",
        "api_base_env": "",
    },
    "nim": {
        "model": "nvidia_nim/google/gemma-4-31b-it",
        "api_key_env": "NVIDIA_NIM_API_KEY",
        "api_base_env": "",
    },
    "together": {
        "model": "together_ai/google/gemma-4-31B-it",
        "api_key_env": "TOGETHER_API_KEY",
        "api_base_env": "",
    },
    "local": {
        # llama.cpp llama-server (OpenAI-compatible) hosting Qwen on :8003.
        # The "openai/<name>" prefix tells LiteLLM to route via api_base.
        "model": "openai/qwen",
        "api_key_env": "LOCAL_API_KEY",
        "api_base_env": "LOCAL_API_BASE",
    },
    "local_gemma": {
        # OpenAI-compatible server hosting Gemma 4 31B (AWQ) on :8002.
        # Edit this string if your server exposes the model under a different
        # name, or override at runtime with AGENT_MODEL.
        "model": "openai/cyankiwi/gemma-4-31B-it-AWQ-4bit",
        "api_key_env": "LOCAL_API_KEY",
        "api_base_env": "LOCAL_API_BASE_GEMMA",
    },
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # --- Master switch ---
    llm_profile: str = "deepinfra"

    # --- Optional overrides (blank = use profile default) ---
    agent_model: str = ""
    agent_api_base: str = ""

    # --- Agent loop ---
    agent_max_turns: int = 15
    agent_subagent_max_turns: int = 30

    # --- Tool output limits ---
    tool_output_max_chars: int = 8000
    firecrawl_max_content_length: int = 20000

    # --- Browser rate limiting (local path — used in PR4) ---
    min_navigation_delay: float = 2.0
    max_navigation_delay: float = 5.0
    page_load_timeout: int = 30000

    # --- Firecrawl MCP ---
    firecrawl_api_key: str = ""
    mcp_server_url: str = "https://mcp.firecrawl.dev"
    mcp_timeout: int = 10
    mcp_client_timeout: int = 20

    # --- Misc ---
    debug_mode: bool = False
    use_agentic: bool = True

    @property
    def resolved_agent_model(self) -> str:
        return self.agent_model or _LLM_PROFILES[self.llm_profile]["model"]

    @property
    def resolved_api_key(self) -> str:
        env = _LLM_PROFILES[self.llm_profile].get("api_key_env", "")
        return os.getenv(env, "") if env else ""

    @property
    def resolved_api_base(self) -> str:
        if self.agent_api_base:
            return self.agent_api_base
        env = _LLM_PROFILES[self.llm_profile].get("api_base_env", "")
        return os.getenv(env, "") if env else ""

    @property
    def running_in_docker(self) -> bool:
        return os.path.exists("/.dockerenv") or os.getenv("RUNNING_IN_DOCKER") == "true"

    @property
    def browser_visible_supported(self) -> bool:
        return (not self.running_in_docker) or os.getenv("BROWSER_VISIBLE_SUPPORTED") == "true"

    @property
    def mcp_url(self) -> str:
        return f"{self.mcp_server_url}/{self.firecrawl_api_key}/v2/mcp"

    def log_config_summary(self, logger: Optional[logging.Logger] = None) -> None:
        if logger is None:
            logger = logging.getLogger(__name__)
        logger.info("Knowledge Robot config:")
        logger.info("  LLM profile: %s", self.llm_profile)
        logger.info("  Resolved model: %s", self.resolved_agent_model)
        logger.info("  API key set: %s", bool(self.resolved_api_key))
        logger.info("  API base: %s", self.resolved_api_base or "(provider default)")
        logger.info("  Firecrawl key set: %s", bool(self.firecrawl_api_key))
        logger.info("  Running in Docker: %s", self.running_in_docker)
        logger.info("  Browser-visible supported: %s", self.browser_visible_supported)
        logger.info("  Debug mode: %s", self.debug_mode)


settings = Settings()


def get_config() -> Settings:
    return settings


def reload_config() -> Settings:
    global settings
    settings = Settings()
    return settings
