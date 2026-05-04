"""dynamic_agent.py — thin orchestrator over agent.py.

For each CSV row:
1. Validate schema, interpolate prompt with row values.
2. Build a dynamic Pydantic model from the schema.
3. Run the agent (Firecrawl path). Agent must call submit_result terminally.
4. Parse submit_result's JSON into the dynamic model. Fall back to a None-row
   if the agent failed to produce valid output (never let parse errors bubble up).
"""
import logging
from datetime import datetime
from typing import Any, Dict, List

from agent import run_agent
from config import settings
from utils import (
    create_dynamic_pydantic_model,
    interpolate_prompt,
    validate_output_schema,
)

logger = logging.getLogger(__name__)

ALLOWED_BACKENDS = {"firecrawl", "local"}


async def process_row(
    row_data: Dict[str, Any],
    prompt_template: str,
    output_schema: List[Dict[str, str]],
    scrape_backend: str = "local",
    browser_visible: bool = False,
    enable_search: bool = False,
) -> Dict[str, Any]:
    """Process a single CSV row. Returns a dict matching the output schema."""
    if scrape_backend not in ALLOWED_BACKENDS:
        logger.error("Invalid scrape_backend: %s", scrape_backend)
        return {f["name"]: None for f in output_schema}

    if not settings.resolved_api_key:
        logger.error("LLM API key not configured for profile %s", settings.llm_profile)
        return {f["name"]: None for f in output_schema}

    if scrape_backend == "firecrawl" and not settings.firecrawl_api_key:
        logger.error("FIRECRAWL_API_KEY not configured")
        return {f["name"]: None for f in output_schema}

    try:
        validate_output_schema(output_schema)
        user_task = interpolate_prompt(prompt_template, row_data)
        OutputModel = create_dynamic_pydantic_model(output_schema, "AnalysisOutput")

        logger.info(
            "Processing row (backend=%s, visible=%s, search=%s): %s",
            scrape_backend, browser_visible, enable_search, user_task[:120],
        )

        final_json = await run_agent(
            user_task=user_task,
            output_schema=output_schema,
            output_model=OutputModel,
            scrape_backend=scrape_backend,
            browser_visible=browser_visible,
            enable_search=enable_search,
        )

        try:
            parsed = OutputModel.model_validate_json(final_json).model_dump()
        except Exception as e:
            logger.error(
                "Agent failed to produce valid submit_result JSON: %s. Raw output: %s",
                e, final_json[:500],
            )
            parsed = {f["name"]: None for f in output_schema}

        parsed["_processed_at"] = datetime.utcnow().isoformat()
        return parsed

    except Exception as e:
        logger.error("Unhandled error in process_row: %s", e, exc_info=True)
        return {f["name"]: None for f in output_schema}


def get_agent_status() -> Dict[str, Any]:
    available_backends = ["local"]
    if settings.firecrawl_api_key:
        available_backends.append("firecrawl")

    return {
        "litellm_model_initialized": bool(settings.resolved_api_key),
        "model": settings.resolved_agent_model,
        "llm_profile": settings.llm_profile,
        "firecrawl_configured": bool(settings.firecrawl_api_key),
        "running_in_docker": settings.running_in_docker,
        "browser_visible_supported": settings.browser_visible_supported,
        "available_scrape_backends": available_backends,
        "max_tool_calls": settings.agent_max_turns,
        "content_truncation_limit": settings.firecrawl_max_content_length,
    }
