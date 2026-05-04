"""Integration tests for the Flask wire protocol — the §2.1 contract.

Uses Flask's test client. The agent runtime is monkeypatched to a stub that
returns canned output, so we never need real LLM credentials in CI.

The contract these tests pin is documented in backend/README.md →
"Response contract (load-bearing for consumers)".
"""
import json
from unittest.mock import patch

import pytest
import api  # type: ignore[import-not-found]


@pytest.fixture
def client():
    """Flask test client. App is the real one from api.py."""
    api.app.config["TESTING"] = True
    with api.app.test_client() as c:
        yield c


@pytest.fixture
def mock_process_row(stub_process_row):
    """Patch dynamic_agent.process_row in api.py's namespace.

    api.py imports `process_row` directly, so we patch the binding inside
    api's module namespace — patching dynamic_agent.process_row alone wouldn't
    affect the already-imported name.
    """
    async def async_stub(row_data, prompt, output_schema, **kwargs):
        return stub_process_row(row_data, prompt, output_schema, **kwargs)

    with patch.object(api, "process_row", side_effect=async_stub) as m:
        yield m


# ----- /health -----

class TestHealthEndpoint:
    def test_returns_200_with_required_keys(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.get_json()
        # Required keys per the response contract.
        assert body["status"] == "healthy"
        assert body["service"] == "knowledge-robot"
        assert "version" in body
        assert "agent_ready" in body
        assert "model" in body


# ----- /api/agent-status -----

class TestAgentStatusEndpoint:
    def test_returns_capability_keys_consumers_rely_on(self, client):
        resp = client.get("/api/agent-status")
        assert resp.status_code == 200
        body = resp.get_json()
        # Frontend reads these on mount to grey out unsupported options.
        assert "available_scrape_backends" in body
        assert isinstance(body["available_scrape_backends"], list)
        assert "local" in body["available_scrape_backends"]
        assert "browser_visible_supported" in body
        assert isinstance(body["browser_visible_supported"], bool)
        assert "model" in body
        assert "llm_profile" in body


# ----- /api/process-row happy path -----

class TestProcessRowHappyPath:
    def test_returns_output_and_metadata(self, client, mock_process_row, sample_output_schema, sample_row_data):
        body_in = {
            "row_data": sample_row_data,
            "prompt": "Analyze {customer}'s {product} review: {review}",
            "output_schema": sample_output_schema,
        }
        resp = client.post(
            "/api/process-row",
            data=json.dumps(body_in),
            content_type="application/json",
        )
        assert resp.status_code == 200
        body = resp.get_json()

        # Top-level shape — load-bearing per the response contract.
        assert "output" in body, "top-level 'output' key is part of the contract"
        assert "metadata" in body
        # Each schema field is in output.
        for field in sample_output_schema:
            assert field["name"] in body["output"]
        # Underscore-prefixed metadata convention.
        assert "_processed_at" in body["output"]
        # Metadata fields.
        assert "processing_time_ms" in body["metadata"]
        assert isinstance(body["metadata"]["processing_time_ms"], int)
        assert body["metadata"]["row_data_received"] is True
        assert body["metadata"]["schema_fields_count"] == len(sample_output_schema)

    def test_default_scrape_backend_is_local(self, client, mock_process_row, sample_output_schema, sample_row_data):
        """Per contract: omitting scrape_backend → defaults to 'local'."""
        body_in = {
            "row_data": sample_row_data,
            "prompt": "test",
            "output_schema": sample_output_schema,
            # NOTE: no scrape_backend
        }
        resp = client.post("/api/process-row", json=body_in)
        assert resp.status_code == 200
        # Confirm the stub was called with scrape_backend='local'.
        args, kwargs = mock_process_row.call_args
        assert kwargs.get("scrape_backend") == "local"

    def test_default_enable_search_is_false(self, client, mock_process_row, sample_output_schema, sample_row_data):
        """Per contract: omitting enable_search → defaults to false."""
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "prompt": "test",
                "output_schema": sample_output_schema,
            },
        )
        assert resp.status_code == 200
        args, kwargs = mock_process_row.call_args
        assert kwargs.get("enable_search") is False

    def test_default_browser_visible_is_false(self, client, mock_process_row, sample_output_schema, sample_row_data):
        """Per contract: omitting browser_visible → defaults to false."""
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "prompt": "test",
                "output_schema": sample_output_schema,
            },
        )
        assert resp.status_code == 200
        args, kwargs = mock_process_row.call_args
        assert kwargs.get("browser_visible") is False


# ----- /api/process-row 4xx error cases -----

class TestProcessRowErrors:
    def test_no_body_returns_error(self, client):
        # Flask raises UnsupportedMediaType when there's no Content-Type, which
        # the API's generic exception handler turns into 500. Not ideal — a
        # future cleanup could special-case missing body to 400 — but we pin
        # current behavior here. What matters for the contract: response.ok is
        # false so consumers know to bail.
        resp = client.post("/api/process-row")
        assert resp.status_code >= 400, "any error status is acceptable; consumer reads response.ok"
        assert not resp.is_json or "error" in resp.get_json()

    def test_empty_body_returns_400(self, client):
        resp = client.post(
            "/api/process-row",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_missing_row_data_returns_400(self, client, sample_output_schema):
        resp = client.post(
            "/api/process-row",
            json={
                "prompt": "test",
                "output_schema": sample_output_schema,
            },
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "row_data" in body["error"]

    def test_missing_prompt_returns_400(self, client, sample_output_schema, sample_row_data):
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "output_schema": sample_output_schema,
            },
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "prompt" in body["error"]

    def test_missing_output_schema_returns_400(self, client, sample_row_data):
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "prompt": "test",
            },
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "output_schema" in body["error"]

    def test_invalid_scrape_backend_returns_400(self, client, sample_row_data, sample_output_schema):
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "prompt": "test",
                "output_schema": sample_output_schema,
                "scrape_backend": "none",  # explicitly rejected per the contract
            },
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "scrape_backend" in body["error"]


# ----- API key authentication -----

class TestAuth:
    def test_no_api_key_set_means_no_auth(self, client, mock_process_row, sample_output_schema, sample_row_data):
        """When API_SECRET_KEY env var is empty (the dev default), auth is skipped."""
        # conftest sets API_SECRET_KEY="" so auth is disabled.
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "prompt": "test",
                "output_schema": sample_output_schema,
            },
        )
        assert resp.status_code == 200

    def test_wrong_api_key_returns_401_when_configured(
        self, client, monkeypatch, sample_output_schema, sample_row_data,
    ):
        monkeypatch.setenv("API_SECRET_KEY", "secret-123")
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "prompt": "test",
                "output_schema": sample_output_schema,
            },
            headers={"X-API-Key": "wrong-key"},
        )
        assert resp.status_code == 401
        body = resp.get_json()
        assert "Unauthorized" in body["error"]

    def test_correct_api_key_passes_through(
        self, client, monkeypatch, mock_process_row, sample_output_schema, sample_row_data,
    ):
        monkeypatch.setenv("API_SECRET_KEY", "secret-123")
        resp = client.post(
            "/api/process-row",
            json={
                "row_data": sample_row_data,
                "prompt": "test",
                "output_schema": sample_output_schema,
            },
            headers={"X-API-Key": "secret-123"},
        )
        assert resp.status_code == 200
