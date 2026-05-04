"""Tests for tools/firecrawl.py — argument sanitization, truncation, error catching.

These tests don't touch any real Firecrawl service. They construct a wrapper
around a fake MCP server and exercise the three behaviours documented in the
module docstring.
"""
from typing import Any

import pytest

from tools.firecrawl import (  # type: ignore[import-not-found]
    TruncatingMCPWrapper,
    _sanitize_arguments,
)


# ----- _sanitize_arguments -----

class TestSanitizeArguments:
    def test_scrape_strips_extras(self):
        """Gemma sometimes hallucinates `scrapeOptions` and other extras."""
        result = _sanitize_arguments(
            "firecrawl_scrape",
            {
                "url": "https://example.com",
                "formats": ["html", "markdown"],  # should be force-set to markdown
                "scrapeOptions": {"foo": "bar"},  # hallucinated, must drop
                "extra_garbage": "junk",  # ditto
            },
        )
        assert result == {"url": "https://example.com", "formats": ["markdown"]}

    def test_scrape_force_sets_markdown_only(self):
        result = _sanitize_arguments("firecrawl_scrape", {"url": "https://x.com"})
        assert result["formats"] == ["markdown"]

    def test_scrape_missing_url_becomes_empty(self):
        result = _sanitize_arguments("firecrawl_scrape", {})
        assert result == {"url": "", "formats": ["markdown"]}

    def test_search_strips_extras(self):
        result = _sanitize_arguments(
            "firecrawl_search",
            {
                "query": "knowledge robot",
                "limit": 10,
                "scrapeOptions": {"f": 1},  # must drop
                "country": "us",  # not in known-good keys, must drop
            },
        )
        assert result == {"query": "knowledge robot", "limit": 10}

    def test_search_without_limit(self):
        result = _sanitize_arguments("firecrawl_search", {"query": "foo"})
        assert result == {"query": "foo"}

    def test_unknown_tool_passes_through(self):
        # Defensive: unknown tools shouldn't be molested.
        original = {"some": "arg"}
        result = _sanitize_arguments("firecrawl_unknown", original)
        assert result == original


# ----- TruncatingMCPWrapper truncation -----

class _FakeText:
    def __init__(self, text: str):
        self.text = text


class _FakeResult:
    def __init__(self, text: str):
        self.content = [_FakeText(text)]


class _FakeMCPServer:
    """Minimal stand-in for an MCPServerStreamableHttp."""

    def __init__(self, response: Any = None, raise_on_call: Exception | None = None):
        self.response = response
        self.raise_on_call = raise_on_call
        self.call_log: list[tuple[str, dict]] = []
        self.name = "FakeMCP"

    async def call_tool(self, tool_name: str, arguments: dict):
        self.call_log.append((tool_name, arguments))
        if self.raise_on_call:
            raise self.raise_on_call
        return self.response


class TestTruncation:
    @pytest.fixture
    def long_text(self) -> str:
        # Build a deterministic 50-char banner repeated until we have ~30K chars.
        return ("HEAD" + "x" * 96 + "\n") * 300  # 30,000 chars

    async def test_short_content_passes_through_untouched(self):
        server = _FakeMCPServer(response=_FakeResult("short content"))
        wrapper = TruncatingMCPWrapper(server, max_length=20000)
        result = await wrapper.call_tool("firecrawl_scrape", {"url": "https://x.com"})
        assert result.content[0].text == "short content"
        assert wrapper.truncation_stats == []

    async def test_long_content_gets_truncated(self, long_text):
        server = _FakeMCPServer(response=_FakeResult(long_text))
        wrapper = TruncatingMCPWrapper(server, max_length=10000)
        result = await wrapper.call_tool("firecrawl_scrape", {"url": "https://x.com"})

        truncated = result.content[0].text
        # Original was 30K chars; truncation cap is 10K with extra banner text.
        assert len(truncated) < len(long_text)
        assert "TRUNCATED" in truncated
        # Stats logged.
        assert len(wrapper.truncation_stats) == 1
        assert wrapper.truncation_stats[0]["tool"] == "firecrawl_scrape"
        assert wrapper.truncation_stats[0]["original"] == len(long_text)

    async def test_truncation_keeps_head_and_tail(self):
        # 90% head + 10% tail per the wrapper's contract.
        head = "HEADHEADHEADHEAD" * 1000  # 16K
        tail = "TAILTAILTAILTAIL" * 1000  # 16K
        text = head + tail  # 32K
        server = _FakeMCPServer(response=_FakeResult(text))
        wrapper = TruncatingMCPWrapper(server, max_length=10000)
        result = await wrapper.call_tool("firecrawl_scrape", {"url": "https://x.com"})

        truncated = result.content[0].text
        # 90% of 10K = 9000 chars from start; remainder from end.
        assert truncated.startswith("HEAD")
        assert truncated.endswith("TAIL")


class TestErrorCatching:
    async def test_mcp_exception_returns_text_result_not_raised(self):
        """The wrapper must never raise — StopAtTools machinery breaks if it does."""
        boom = RuntimeError("MCP server unreachable")
        server = _FakeMCPServer(raise_on_call=boom)
        wrapper = TruncatingMCPWrapper(server, max_length=10000)

        # Must NOT raise.
        result = await wrapper.call_tool("firecrawl_scrape", {"url": "https://x.com"})

        # Must return a CallToolResult-shaped object with the error embedded.
        assert hasattr(result, "content")
        assert "MCP server unreachable" in result.content[0].text
        assert result.content[0].text.startswith("Error:")


class TestSanitizationAppliedDuringCall:
    async def test_call_strips_hallucinated_args_before_dispatch(self):
        server = _FakeMCPServer(response=_FakeResult("ok"))
        wrapper = TruncatingMCPWrapper(server, max_length=10000)

        await wrapper.call_tool(
            "firecrawl_scrape",
            {
                "url": "https://example.com",
                "scrapeOptions": {"foo": "bar"},  # would crash real Firecrawl
                "weird": True,
            },
        )

        # The underlying server must have received only the known-good keys.
        assert len(server.call_log) == 1
        _, args = server.call_log[0]
        assert args == {"url": "https://example.com", "formats": ["markdown"]}
        assert "scrapeOptions" not in args
        assert "weird" not in args
