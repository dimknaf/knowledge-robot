"""crawl4ai wrapper for clean markdown extraction.

Used by the local scrape backend. Falls back to Playwright body text in tools/local.py
if crawl4ai isn't running (e.g. fetch failure).
"""
import logging
from pathlib import Path
from typing import Optional

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

from config import settings

logger = logging.getLogger(__name__)


class CrawlBrowserManager:
    def __init__(self, session_dir: Path, visible: bool = False):
        self.session_dir = session_dir
        self.visible = visible
        self._crawler: Optional[AsyncWebCrawler] = None

    async def launch(self) -> None:
        self.session_dir.mkdir(parents=True, exist_ok=True)
        extra_args: list[str] = []
        if settings.running_in_docker:
            extra_args.append("--no-sandbox")

        cfg = BrowserConfig(
            headless=not self.visible,
            browser_type="chromium",
            use_persistent_context=True,
            user_data_dir=str(self.session_dir),
            extra_args=extra_args,
        )
        self._crawler = AsyncWebCrawler(config=cfg, verbose=False)
        await self._crawler.start()
        logger.info("crawl4ai launched (visible=%s, docker=%s)", self.visible, settings.running_in_docker)

    async def fetch(self, url: str) -> str:
        if not self._crawler:
            raise RuntimeError("crawl4ai not launched")
        run_cfg = CrawlerRunConfig()
        result = await self._crawler.arun(url, config=run_cfg)
        if not result.success:
            return f"ERROR: Failed to fetch (status {result.status_code})"
        if result.markdown:
            return result.markdown.fit_markdown or result.markdown.raw_markdown or ""
        return ""

    async def close(self) -> None:
        if self._crawler:
            await self._crawler.close()
            self._crawler = None
