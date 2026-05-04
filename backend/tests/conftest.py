"""Shared pytest fixtures.

`pythonpath = ["API"]` in pyproject.toml puts backend/API/ on sys.path before
collection, so tests can `from utils import ...`, `from tools.local import ...`,
etc. — same import shape the application uses at runtime.
"""
import os
from typing import Any, Optional

import pytest

# Ensure the backend's profile loader doesn't try to read a real .env at import
# time. Setting LLM_PROFILE explicitly + leaving DEEPINFRA_API_KEY unset is
# fine — config.py never raises, it just exposes empty strings.
os.environ.setdefault("LLM_PROFILE", "deepinfra")
os.environ.setdefault("DEEPINFRA_API_KEY", "")
os.environ.setdefault("FIRECRAWL_API_KEY", "")
os.environ.setdefault("API_SECRET_KEY", "")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")


class FakeBrowser:
    """Stand-in for browser.BrowserManager — no Playwright launched."""

    def __init__(self, label: str = "fake"):
        self.label = label
        self.page = None

    async def navigate(self, url: str) -> str:
        return f"<fake body for {url} from {self.label}>"

    async def close(self) -> None:
        pass


class FakeCrawlBrowser:
    """Stand-in for crawl_browser.CrawlBrowserManager."""

    def __init__(self, label: str = "fake"):
        self.label = label

    async def fetch(self, url: str) -> str:
        return f"# Fake markdown for {url} from {self.label}"

    async def close(self) -> None:
        pass


@pytest.fixture
def fake_browser() -> FakeBrowser:
    return FakeBrowser()


@pytest.fixture
def fake_crawl_browser() -> FakeCrawlBrowser:
    return FakeCrawlBrowser()


@pytest.fixture
def sample_output_schema() -> list[dict[str, str]]:
    return [
        {"name": "sentiment", "type": "text", "description": "positive/negative/neutral"},
        {"name": "score", "type": "number", "description": "0-100"},
        {"name": "is_complaint", "type": "boolean", "description": "true if complaining"},
    ]


@pytest.fixture
def sample_row_data() -> dict[str, Any]:
    return {"customer": "John", "product": "Laptop", "review": "Great fast laptop!"}


def _stub_process_row_response(
    row_data: dict, prompt: str, output_schema: list, **_: Any
) -> dict:
    """Canned response for the dynamic_agent.process_row monkeypatch in API tests.

    Mirrors the real shape from backend/API/dynamic_agent.py: each schema field
    keyed in the output dict, plus a `_processed_at` ISO timestamp.
    """
    from datetime import datetime, timezone

    out: dict[str, Optional[Any]] = {}
    for field in output_schema:
        name = field["name"]
        ftype = field.get("type", "text")
        if ftype == "text":
            out[name] = f"stub-{name}"
        elif ftype == "number":
            out[name] = 42
        elif ftype == "boolean":
            out[name] = True
        elif ftype == "date":
            out[name] = "2026-01-01"
        else:
            out[name] = None
    out["_processed_at"] = datetime.now(timezone.utc).isoformat()
    return out


@pytest.fixture
def stub_process_row():
    """Returns the stub callable. Tests can monkeypatch dynamic_agent.process_row to it."""
    return _stub_process_row_response
