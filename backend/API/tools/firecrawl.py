"""Firecrawl MCP server + hardened truncating wrapper.

The wrapper has three responsibilities:
1. Argument sanitization — small models (Gemma) hallucinate scrapeOptions etc.
2. Content truncation — Firecrawl results can exceed 100K chars.
3. Error catching — MCP exceptions crash StopAtTools machinery; catch and surface as text.
"""
import logging
from typing import Any

from agents.mcp import MCPServerStreamableHttp, ToolFilterContext

from config import settings

logger = logging.getLogger(__name__)


def _tool_filter_factory(enable_search: bool):
    async def tool_filter(_ctx: ToolFilterContext, tool) -> bool:
        if enable_search:
            return tool.name in ("firecrawl_scrape", "firecrawl_search")
        return tool.name == "firecrawl_scrape"
    return tool_filter


def get_firecrawl_mcp(enable_search: bool) -> MCPServerStreamableHttp:
    """Create a Firecrawl MCP server. Context-managed per task."""
    return MCPServerStreamableHttp(
        name="FireCrawl MCP Server",
        params={
            "url": settings.mcp_url,
            "headers": {},
            "timeout": settings.mcp_timeout,
        },
        cache_tools_list=True,
        max_retry_attempts=3,
        tool_filter=_tool_filter_factory(enable_search),
        client_session_timeout_seconds=float(settings.mcp_client_timeout),
    )


def _sanitize_arguments(tool_name: str, arguments: dict) -> dict:
    """Strip everything except known-good keys. Small models hallucinate extras."""
    if tool_name == "firecrawl_scrape":
        return {"url": arguments.get("url", ""), "formats": ["markdown"]}
    if tool_name == "firecrawl_search":
        clean = {"query": arguments.get("query", "")}
        if "limit" in arguments:
            clean["limit"] = arguments["limit"]
        return clean
    return arguments


class TruncatingMCPWrapper:
    """Wraps a Firecrawl MCP server with arg sanitization, truncation, and error catching."""

    def __init__(self, wrapped_server, max_length: int):
        self.server = wrapped_server
        self.max_length = max_length
        self.truncation_stats: list[dict] = []
        self.name = getattr(wrapped_server, "name", "FireCrawl MCP Server")

    async def __aenter__(self):
        await self.server.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return await self.server.__aexit__(exc_type, exc_val, exc_tb)

    async def connect(self):
        return await self.server.connect()

    async def cleanup(self):
        return await self.server.cleanup()

    async def list_tools(self, run_context=None, agent=None):
        return await self.server.list_tools(run_context, agent)

    async def call_tool(self, tool_name: str, arguments: dict) -> Any:
        sanitized = _sanitize_arguments(tool_name, arguments)
        if sanitized != arguments:
            logger.debug("Sanitized %s args: %s -> %s", tool_name, arguments, sanitized)

        try:
            result = await self.server.call_tool(tool_name, sanitized)
        except Exception as e:
            from mcp.types import CallToolResult, TextContent
            logger.warning("MCP tool error for %s: %s", tool_name, e)
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {e}")])

        if hasattr(result, "content") and result.content:
            item = result.content[0]
            if hasattr(item, "text") and len(item.text) > self.max_length:
                original_length = len(item.text)
                item.text = self._truncate_content(item.text)
                self.truncation_stats.append({
                    "tool": tool_name,
                    "original": original_length,
                    "truncated": len(item.text),
                })
                logger.info(
                    "Truncated %s output: %d → %d chars",
                    tool_name, original_length, len(item.text),
                )

        return result

    def _truncate_content(self, text: str) -> str:
        keep_start = int(self.max_length * 0.9)
        keep_end = self.max_length - keep_start
        return (
            text[:keep_start]
            + f"\n\n[... TRUNCATED: {len(text) - self.max_length} chars removed ...]\n\n"
            + text[-keep_end:]
        )

    def __getattr__(self, name):
        return getattr(self.server, name)
