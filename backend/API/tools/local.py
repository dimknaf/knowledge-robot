"""Local scraping tools — search_google + visit_webpage.

Both browser handles live in `contextvars.ContextVar` so that concurrent
requests in the same Python process get their own per-task browsers
instead of clobbering a shared module global. The orchestrator calls
`set_browser` / `set_crawl_browser` from inside `_run_local` before
`Runner.run`; the agent's tool calls run as child tasks of that coroutine
and inherit the same context.

search_google uses Playwright to scrape Google's SERP (brittle vs. firecrawl_search).
visit_webpage prefers crawl4ai for clean markdown, falls back to Playwright body text.
"""
import logging
import re
from contextvars import ContextVar
from typing import Optional

from agents import function_tool

from browser import BrowserManager
from config import settings
from crawl_browser import CrawlBrowserManager

logger = logging.getLogger(__name__)

_browser_var: ContextVar[Optional[BrowserManager]] = ContextVar("_browser", default=None)
_crawl_browser_var: ContextVar[Optional[CrawlBrowserManager]] = ContextVar(
    "_crawl_browser", default=None,
)


def set_browser(browser: Optional[BrowserManager]) -> None:
    _browser_var.set(browser)


def set_crawl_browser(crawl_browser: Optional[CrawlBrowserManager]) -> None:
    _crawl_browser_var.set(crawl_browser)


def _truncate(text: str) -> str:
    cap = settings.tool_output_max_chars
    if len(text) <= cap:
        return text
    return text[:cap] + "\n... [truncated]"


@function_tool
async def search_google(query: str) -> str:
    """Search Google for a query and return the top results with titles and URLs.

    Use this to find information about companies, products, or any external topic.

    Args:
        query: The search query string.
    """
    browser = _browser_var.get()
    if not browser:
        return "ERROR: Browser not initialized for local scrape backend"

    url = f"https://www.google.com/search?q={query}&num=10"
    try:
        body_text = await browser.navigate(url)
        page = browser.page

        links: list[str] = []
        anchors = await page.query_selector_all("a[href]")
        for anchor in anchors[:30]:
            href = await anchor.get_attribute("href")
            text = (await anchor.inner_text()).strip()
            if not href or not text:
                continue
            if href.startswith("http") and "google" not in href:
                links.append(f"{text[:80]} -> {href}")

        out = f"=== Google Search Results for: {query} ===\n\n"
        if links:
            out += "Key Links:\n" + "\n".join(links[:10]) + "\n\n"
        out += "Page Content:\n" + _truncate(body_text)
        return out

    except Exception as e:
        logger.error("Google search failed for %r: %s", query, e)
        return f"ERROR: Search failed - {e}"


@function_tool
async def visit_webpage(url: str) -> str:
    """Visit any webpage and extract clean markdown content.

    Use this for company websites, articles, about pages, etc.

    Args:
        url: The full URL to visit.
    """
    crawl_browser = _crawl_browser_var.get()
    # Prefer crawl4ai for clean markdown.
    if crawl_browser:
        try:
            markdown = await crawl_browser.fetch(url)
            return f"=== Webpage: {url} ===\n\n{_truncate(markdown)}"
        except Exception as e:
            logger.error("crawl4ai fetch failed for %s: %s", url, e)

    # Fallback: Playwright body text.
    browser = _browser_var.get()
    if not browser:
        return "ERROR: Browser not initialized for local scrape backend"
    try:
        body_text = await browser.navigate(url)
        body_text = re.sub(r"\n{3,}", "\n\n", body_text)
        body_text = re.sub(r" {2,}", " ", body_text)
        return f"=== Webpage: {url} ===\n\n{_truncate(body_text)}"
    except Exception as e:
        logger.error("Page visit failed for %s: %s", url, e)
        return f"ERROR: Failed to load page - {e}"
