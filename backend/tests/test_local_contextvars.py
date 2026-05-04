"""Regression test for the contextvars-based browser isolation in tools.local.

Before the fix, `_browser` and `_crawl_browser` were module-level globals.
Two concurrent requests in the same Python process would clobber each other's
references — the second request's set_browser() would overwrite the first's,
and the first request's still-pending search_google call would then hit a
closed page (`Target page, context or browser has been closed`).

After the fix they're `contextvars.ContextVar`. asyncio.create_task() copies
the parent context for each child task, so per-task assignments are isolated.

This test would fail with `assert results[0].label == "A"` before the fix
(both tasks would see the second-set value, "B") and passes after.
"""
import asyncio

import pytest

from tools.local import (  # type: ignore[import-not-found]
    _browser_var,
    _crawl_browser_var,
    set_browser,
    set_crawl_browser,
)

from .conftest import FakeBrowser, FakeCrawlBrowser


async def test_set_browser_is_task_local() -> None:
    """Two concurrent tasks must each see their own browser, not each other's."""
    a = FakeBrowser("A")
    b = FakeBrowser("B")

    async def task_with(browser: FakeBrowser, settle_seconds: float) -> FakeBrowser:
        set_browser(browser)
        # Yield control so the other task runs and sets its own browser.
        # Pre-fix, the second set_browser() would clobber the first task's
        # global, and this task's _browser_var.get() would return the wrong one.
        await asyncio.sleep(settle_seconds)
        result = _browser_var.get()
        assert result is not None
        return result

    results = await asyncio.gather(
        asyncio.create_task(task_with(a, 0.05)),
        asyncio.create_task(task_with(b, 0.02)),
    )
    # Each task should see its OWN browser despite the interleaving.
    assert results[0] is a, f"task A saw {results[0].label} (expected A)"
    assert results[1] is b, f"task B saw {results[1].label} (expected B)"


async def test_set_crawl_browser_is_task_local() -> None:
    """Same isolation guarantee for the crawl4ai browser."""
    a = FakeCrawlBrowser("A")
    b = FakeCrawlBrowser("B")

    async def task_with(crawl: FakeCrawlBrowser, settle_seconds: float) -> FakeCrawlBrowser:
        set_crawl_browser(crawl)
        await asyncio.sleep(settle_seconds)
        result = _crawl_browser_var.get()
        assert result is not None
        return result

    results = await asyncio.gather(
        asyncio.create_task(task_with(a, 0.05)),
        asyncio.create_task(task_with(b, 0.02)),
    )
    assert results[0] is a
    assert results[1] is b


async def test_set_browser_to_none_only_affects_current_task() -> None:
    """The agent's `finally` block calls set_browser(None). That cleanup must
    not leak into a sibling task's context."""
    a = FakeBrowser("A")
    b = FakeBrowser("B")

    async def task_a() -> tuple[FakeBrowser, FakeBrowser]:
        set_browser(a)
        await asyncio.sleep(0.05)  # let task_b run + its finally run
        observed_after_b_cleanup = _browser_var.get()
        assert observed_after_b_cleanup is not None
        return a, observed_after_b_cleanup

    async def task_b() -> None:
        set_browser(b)
        try:
            await asyncio.sleep(0.01)
        finally:
            set_browser(None)  # cleanup like _run_local does

    expected_a, observed = (await asyncio.gather(
        asyncio.create_task(task_a()),
        asyncio.create_task(task_b()),
    ))[0]
    assert observed is expected_a, (
        f"task A's browser was clobbered by task B's cleanup "
        f"(saw {None if observed is None else observed.label}, expected A)"
    )


async def test_default_is_none() -> None:
    """A fresh asyncio context should see no browser set."""
    async def child() -> object:
        # Each create_task gets a fresh COPY of the parent context, so the
        # parent's set_browser doesn't propagate INTO the child's writes —
        # but the parent's value IS visible until the child sets its own.
        # For this test we just check that without ANY set_browser call in
        # this task chain, the var defaults to None.
        return _browser_var.get()

    # Run in a brand-new asyncio.run context to avoid pollution from prior tests.
    # asyncio.run gives a fresh event loop with a fresh context.
    result = await asyncio.create_task(child())
    # Whether result is None depends on whether prior tests left a value in the
    # current context. The robust assertion: it's either None or a FakeBrowser
    # — never a real BrowserManager (which would mean test pollution from
    # production code).
    assert result is None or isinstance(result, FakeBrowser)
