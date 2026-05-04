"""agent.py — agent factory + runner.

Three scrape backends, picked per request:
- firecrawl: MCP scrape + search via Firecrawl
- local:     Playwright SERP + crawl4ai markdown extraction
- none:      no scraping tools, just LLM + submit_result

Provider selected via settings.llm_profile.
"""
import logging
import tempfile
from pathlib import Path
from typing import Type

from agents import Agent, ModelSettings, Runner, StopAtTools, set_tracing_disabled
from agents.extensions.models.litellm_model import LitellmModel
from pydantic import BaseModel

from config import settings
from tools.firecrawl import TruncatingMCPWrapper, get_firecrawl_mcp
from tools.subagent import delegate_to_subagent, set_request_context
from tools.submit import make_submit_result

logger = logging.getLogger(__name__)

# Disable OpenAI tracing service spam.
set_tracing_disabled(disabled=True)


def _create_model() -> LitellmModel:
    return LitellmModel(
        model=settings.resolved_agent_model,
        api_key=settings.resolved_api_key,
    )


def _build_instructions(user_task: str, output_schema: list[dict], scrape_backend: str) -> str:
    schema_desc = "\n".join(
        f"- {f['name']} ({f['type']}): {f.get('description', '')}"
        for f in output_schema
    )

    if scrape_backend == "firecrawl":
        tool_block = (
            "Use firecrawl_scrape and (if available) firecrawl_search only when external "
            "information is needed. For firecrawl_scrape always pass formats: [\"markdown\"] "
            "and never pass scrapeOptions. For firecrawl_search pass only "
            "{\"query\": \"...\", \"limit\": 10}."
        )
    elif scrape_backend == "local":
        tool_block = (
            "Use visit_webpage to read pages you know about, and search_google (if available) "
            "to find new ones. Be efficient — these tools drive a real browser."
        )
    else:
        raise ValueError(f"Unknown scrape_backend: {scrape_backend}")

    return f"""You are a data analysis agent.

Your task: {user_task}

{tool_block}

When you have enough information, call submit_result with a JSON object matching this schema:
{schema_desc}

Be efficient. Complete the task in fewer than 10 tool calls when research is needed. Call submit_result exactly once to finish.
"""


async def _run_firecrawl(
    user_task: str, output_schema: list[dict], output_model: Type[BaseModel], enable_search: bool,
) -> str:
    model = _create_model()
    submit_tool = make_submit_result(output_model)
    instructions = _build_instructions(user_task, output_schema, "firecrawl")

    async with get_firecrawl_mcp(enable_search) as firecrawl_server:
        wrapped = TruncatingMCPWrapper(
            firecrawl_server, max_length=settings.firecrawl_max_content_length,
        )
        agent = Agent(
            name="CSV Analysis Agent",
            instructions=instructions,
            model=model,
            model_settings=ModelSettings(),
            mcp_servers=[wrapped],
            tools=[submit_tool, delegate_to_subagent],
            tool_use_behavior=StopAtTools(stop_at_tool_names=["submit_result"]),
        )
        result = await Runner.run(
            starting_agent=agent, input=user_task, max_turns=settings.agent_max_turns,
        )

        if wrapped.truncation_stats:
            n = len(wrapped.truncation_stats)
            total_in = sum(s["original"] for s in wrapped.truncation_stats)
            total_out = sum(s["truncated"] for s in wrapped.truncation_stats)
            logger.info(
                "Truncation summary: %d tool result(s), %d → %d chars",
                n, total_in, total_out,
            )

        return str(result.final_output)


async def _run_local(
    user_task: str,
    output_schema: list[dict],
    output_model: Type[BaseModel],
    browser_visible: bool,
    enable_search: bool,
) -> str:
    from browser import BrowserManager
    from crawl_browser import CrawlBrowserManager
    from tools.local import search_google, set_browser, set_crawl_browser, visit_webpage

    # Display-aware override — defense in depth (frontend already greys this out).
    if browser_visible and not settings.browser_visible_supported:
        logger.info("Forcing headless: no display available")
        browser_visible = False

    session_dir = Path(tempfile.mkdtemp(prefix="kr-browser-"))
    browser = BrowserManager(session_dir / "playwright", visible=browser_visible)
    crawl = CrawlBrowserManager(session_dir / "crawl4ai", visible=browser_visible)

    await browser.launch()
    await crawl.launch()
    set_browser(browser)
    set_crawl_browser(crawl)

    try:
        model = _create_model()
        submit_tool = make_submit_result(output_model)
        instructions = _build_instructions(user_task, output_schema, "local")

        tools_list = [visit_webpage, submit_tool, delegate_to_subagent]
        if enable_search:
            tools_list.insert(0, search_google)

        agent = Agent(
            name="CSV Analysis Agent",
            instructions=instructions,
            model=model,
            model_settings=ModelSettings(),
            tools=tools_list,
            tool_use_behavior=StopAtTools(stop_at_tool_names=["submit_result"]),
        )
        result = await Runner.run(
            starting_agent=agent, input=user_task, max_turns=settings.agent_max_turns,
        )
        return str(result.final_output)
    finally:
        await crawl.close()
        await browser.close()
        set_browser(None)  # type: ignore[arg-type]
        set_crawl_browser(None)  # type: ignore[arg-type]


async def run_agent(
    user_task: str,
    output_schema: list[dict],
    output_model: Type[BaseModel],
    scrape_backend: str,
    browser_visible: bool = False,
    enable_search: bool = False,
) -> str:
    """Dispatcher. Returns the agent's submit_result JSON."""
    set_request_context(enable_search=enable_search)

    if scrape_backend == "firecrawl":
        return await _run_firecrawl(user_task, output_schema, output_model, enable_search)
    if scrape_backend == "local":
        return await _run_local(user_task, output_schema, output_model, browser_visible, enable_search)
    raise ValueError(f"Unknown scrape_backend: {scrape_backend}")
