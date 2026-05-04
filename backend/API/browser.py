"""Playwright BrowserManager — thin wrapper around launch_persistent_context.

When `visible=True` and a display is available, runs Chromium headed so the
operator can watch + clear CAPTCHAs. When `visible=False` (or in Docker without
WSLg), runs headless. The "force headless without a display" decision is made
one level up in agent.run_agent — this class just honors what it's told.
"""
import asyncio
import logging
import random
from pathlib import Path
from typing import Optional

from playwright.async_api import BrowserContext, Page, async_playwright

from config import settings

logger = logging.getLogger(__name__)


class BrowserManager:
    def __init__(self, session_dir: Path, visible: bool = False):
        self.session_dir = session_dir
        self.visible = visible
        self._playwright = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    async def launch(self) -> None:
        self.session_dir.mkdir(parents=True, exist_ok=True)

        args: list[str] = ["--disable-blink-features=AutomationControlled"]
        if settings.running_in_docker:
            # Running as root in container — Chromium needs --no-sandbox.
            args.append("--no-sandbox")
        if not self.visible:
            args.append("--start-minimized")

        self._playwright = await async_playwright().start()
        self.context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.session_dir),
            headless=not self.visible,
            channel="chromium",
            args=args,
        )
        self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()
        await self.page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => false });"
        )
        logger.info("Browser launched (visible=%s, docker=%s)", self.visible, settings.running_in_docker)

    async def navigate(self, url: str) -> str:
        """Navigate, wait for network idle, return body text. Rate-limited."""
        if not self.page:
            raise RuntimeError("Browser not launched")
        await asyncio.sleep(random.uniform(settings.min_navigation_delay, settings.max_navigation_delay))
        await self.page.goto(url, timeout=settings.page_load_timeout)
        await self.page.wait_for_load_state("networkidle", timeout=settings.page_load_timeout)
        return await self.page.inner_text("body")

    async def close(self) -> None:
        if self.context:
            await self.context.close()
        if self._playwright:
            await self._playwright.stop()
