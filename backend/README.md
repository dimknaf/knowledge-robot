# Knowledge Robot — Backend

The agent runtime: a Flask REST API that takes one input row at a time, runs an LLM agent (LiteLLM-driven, profile-pluggable) with web-research tools, and returns a structured result matching the caller's schema. Routes web research through one of two scrape backends (`local` Playwright/crawl4ai, or `firecrawl` MCP) chosen per request.

## Overview

The backend exposes a small HTTP API. Each call accepts one row of input data, a prompt template, and the shape of the desired output. The agent runs a tool-calling LLM loop, optionally searching the web and visiting pages, and terminates by calling a **`submit_result` terminal tool** whose argument type is a Pydantic model generated from the schema — so structured output comes from a single LLM round, not a second parse call. The bundled frontend uses CSV files to drive the API; any other input adapter (a queue worker, a webhook, a CLI) can call the same endpoint.

### Key Features

- **Profile-based LLM provider** — `LLM_PROFILE` flips the whole stack: ships with six profiles (`gemini`, `deepinfra`, `nim`, `together`, `local`, `local_gemma`). Cloud providers (Gemini 3.1 Flash Lite, DeepInfra, NVIDIA NIM, Together) and OpenAI-compatible local servers (llama.cpp, vLLM, LM Studio) all work via the same dict in `config.py`.
- **Two scrape backends, picked per request**:
  - `local` (default) — Playwright (`search_google`) + crawl4ai (`visit_webpage`). Chromium baked into the image.
  - `firecrawl` — Firecrawl MCP (`firecrawl_scrape`, `firecrawl_search`).
- **Hardened MCP wrapper** — argument sanitization (Gemma hallucinates `scrapeOptions`), error catching (so `StopAtTools` doesn't crash), 90/10 truncation.
- **Subagents** — `delegate_to_subagent` with depth cap = 1 for focused side-tasks.
- **Visible browser** — opt-in headed Chromium for local mode (host run, or WSLg overlay on Win11).
- **Structured output via `submit_result`** — agent calls a tool whose argument type is the dynamic Pydantic model; `StopAtTools` halts the runner; we parse `result.final_output` with a `{name: None}` fallback.
- **Production ready** — Gunicorn (16 threads default, 1 worker), CORS, error handling, New Relic integration.

## Architecture

```
backend/
├── API/
│   ├── api.py              # Flask REST API
│   ├── dynamic_agent.py    # Thin orchestrator (~80 lines)
│   ├── agent.py            # Factory + dispatcher (firecrawl vs local)
│   ├── config.py           # pydantic-settings + _LLM_PROFILES dict
│   ├── utils.py            # Dynamic Pydantic model + prompt interpolation
│   ├── browser.py          # Playwright BrowserManager (local backend)
│   ├── crawl_browser.py    # crawl4ai AsyncWebCrawler wrapper
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── submit.py       # make_submit_result(model_class) terminal tool
│   │   ├── firecrawl.py    # TruncatingMCPWrapper (sanitize + truncate + catch)
│   │   ├── local.py        # search_google + visit_webpage
│   │   └── subagent.py     # delegate_to_subagent
│   └── run.sh              # Gunicorn startup script
├── .env                    # Environment variables (not in git)
├── requirements.txt        # Python deps (incl. Playwright + crawl4ai)
└── Dockerfile              # Container build (installs Chromium)
```

### Processing Flow (one row)

1. **API Request**: Frontend sends `row_data`, `prompt`, `output_schema`, `scrape_backend`, `enable_search`, `browser_visible`.
2. **Interpolation**: `{column}` placeholders replaced with row values.
3. **Pydantic Generation**: `create_dynamic_pydantic_model(output_schema)` builds an `AnalysisOutput` class.
4. **Submit tool factory**: `make_submit_result(AnalysisOutput)` produces the terminal `@function_tool`.
5. **Dispatch**: `agent.run_agent(...)` routes to `_run_firecrawl` or `_run_local` based on `scrape_backend`.
6. **Loop**: `Runner.run` iterates up to `agent_max_turns=15` until the agent calls `submit_result`. `StopAtTools(["submit_result"])` halts the runner.
7. **Parse**: `OutputModel.model_validate_json(result.final_output)` → dict. On parse failure → `{name: None for name in schema}` fallback (never bubbles up).
8. **Response**: Structured JSON + `_processed_at` timestamp.

## Quick Start

### Prerequisites

- Python 3.13+
- API key for one of the six built-in profiles (`gemini`, `deepinfra`, `nim`, `together`, `local`, `local_gemma`) — or any LiteLLM-supported provider after adding it to `_LLM_PROFILES`
- Firecrawl API key (only required if you'll use `scrape_backend=firecrawl`)
- For host run: `playwright install chromium` after `pip install`

### Local Development

1. **Install dependencies**:
```bash
cd backend
pip install -r requirements.txt
playwright install chromium    # only needed for host runs
```

2. **Configure environment** (create `.env` — pick the profile you want):
```bash
# Required — LLM provider profile + matching API key
LLM_PROFILE=deepinfra
DEEPINFRA_API_KEY=your-deepinfra-api-key
# GEMINI_API_KEY=your-gemini-api-key            # for LLM_PROFILE=gemini
# NVIDIA_NIM_API_KEY=your-nim-api-key           # for LLM_PROFILE=nim
# TOGETHER_API_KEY=your-together-api-key        # for LLM_PROFILE=together

# Local OpenAI-compatible server (llama.cpp / vLLM / LM Studio):
# LLM_PROFILE=local                              # Qwen on :8003 by default
# LOCAL_API_KEY=sk-noauth                        # any non-empty value
# LOCAL_API_BASE=http://localhost:8003/v1
#   (inside Docker: http://host.docker.internal:8003/v1)

# LLM_PROFILE=local_gemma                        # Gemma 4 31B AWQ on :8002
# LOCAL_API_KEY=sk-noauth
# LOCAL_API_BASE_GEMMA=http://localhost:8002/v1
# AGENT_MODEL=                                   # only needed if your server uses a different model id

# Required if you'll use the firecrawl backend
FIRECRAWL_API_KEY=your-firecrawl-api-key

# Optional overrides
# AGENT_MODEL=                                   # override the profile's model string
# AGENT_API_BASE=                                # global base_url override
# AGENT_MAX_TURNS=15
# FIRECRAWL_MAX_CONTENT_LENGTH=20000
# DEBUG_MODE=true
```

3. **Run server**:
```bash
cd API
python api.py
```

Server runs at `http://localhost:8080`. With host run, `browser_visible=true` pops a real Chromium window during local-mode rows.

### Docker Deployment

**Build & run** (Chromium is installed during build, image grows ~600MB):
```bash
docker-compose -f docker-compose.local.yml up --build -d
```

**Visible browser via WSLg** (Windows 11 only — must be invoked from inside WSL2 so Docker Desktop's volumes pick up the WSLg sockets):
```bash
wsl -- bash -c 'cd /mnt/c/.../knowledge-robot && \
  docker-compose -f docker-compose.local.yml -f docker-compose.windowed.yml up -d'
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_PROFILE` | Yes | `deepinfra` | Picks an entry from `_LLM_PROFILES` in `config.py`. Ships with `gemini` / `deepinfra` / `nim` / `together` / `local` / `local_gemma` |
| `GEMINI_API_KEY` | Yes (for `gemini` profile) | - | Google AI Studio key |
| `DEEPINFRA_API_KEY` | Yes (for `deepinfra` profile) | - | DeepInfra API key |
| `NVIDIA_NIM_API_KEY` | Yes (for `nim` profile) | - | NVIDIA NIM API key |
| `TOGETHER_API_KEY` | Yes (for `together` profile) | - | Together AI API key |
| `LOCAL_API_KEY` | Yes (for `local` / `local_gemma`) | - | Any non-empty string; the OpenAI client validates it client-side, the local server typically ignores it |
| `LOCAL_API_BASE` | Yes (for `local` profile) | - | OpenAI-compatible URL, e.g. `http://localhost:8003/v1` (or `http://host.docker.internal:8003/v1` from inside Docker) |
| `LOCAL_API_BASE_GEMMA` | Yes (for `local_gemma` profile) | - | OpenAI-compatible URL for the Gemma server, e.g. `http://localhost:8002/v1` |
| `FIRECRAWL_API_KEY` | When `scrape_backend=firecrawl` | - | Firecrawl API key |
| `AGENT_MODEL` | No | (profile default) | Override the profile's model string, e.g. `openai/cyankiwi/gemma-4-31B-it-AWQ-4bit` |
| `AGENT_API_BASE` | No | (profile default) | Global `base_url` override (wins over the per-profile `*_API_BASE`) |
| `AGENT_MAX_TURNS` | No | `15` | Max tool calls per row |
| `AGENT_SUBAGENT_MAX_TURNS` | No | `30` | Max tool calls inside a subagent |
| `TOOL_OUTPUT_MAX_CHARS` | No | `8000` | Per-tool truncation cap for local-backend tools |
| `FIRECRAWL_MAX_CONTENT_LENGTH` | No | `20000` | 90/10 truncation cap for Firecrawl results |
| `MCP_SERVER_URL` | No | `https://mcp.firecrawl.dev` | Firecrawl MCP base URL |
| `MCP_TIMEOUT` | No | `10` | MCP HTTP request timeout (seconds) |
| `MCP_CLIENT_TIMEOUT` | No | `20` | MCP client session timeout (seconds) |
| `MIN_NAVIGATION_DELAY` | No | `2.0` | Min Playwright nav delay (seconds, local backend) |
| `MAX_NAVIGATION_DELAY` | No | `5.0` | Max Playwright nav delay (seconds, local backend) |
| `PAGE_LOAD_TIMEOUT` | No | `30000` | Playwright page-load timeout (ms, local backend) |
| `RUNNING_IN_DOCKER` | (auto) | `true` in image | Set in Dockerfile; the agent uses this to add `--no-sandbox` and force-headless |
| `BROWSER_VISIBLE_SUPPORTED` | No | unset | Only set by `docker-compose.windowed.yml`; allows visible Chromium |
| `DEBUG_MODE` | No | `false` | Enable debug logging |
| `KNOWLEDGE_ROBOT_WORKERS` | No | `1` | Gunicorn worker processes |
| `KNOWLEDGE_ROBOT_THREADS` | No | `16` | Threads per worker (bumped from 4 to avoid undici headersTimeout under high concurrency) |
| `KNOWLEDGE_ROBOT_TIMEOUT` | No | `600` | Gunicorn worker timeout (seconds) |

### Supported LLM Providers

Six profiles ship in [API/config.py](API/config.py):

| Profile | Default model | Required env |
|---------|---------------|--------------|
| `gemini` | `gemini/gemini-3.1-flash-lite-preview` | `GEMINI_API_KEY` |
| `deepinfra` | `deepinfra/google/gemma-4-31B-it` | `DEEPINFRA_API_KEY` |
| `nim` | `nvidia_nim/google/gemma-4-31b-it` | `NVIDIA_NIM_API_KEY` |
| `together` | `together_ai/google/gemma-4-31B-it` | `TOGETHER_API_KEY` |
| `local` | `openai/qwen` (llama.cpp Qwen on :8003) | `LOCAL_API_KEY` + `LOCAL_API_BASE` |
| `local_gemma` | `openai/cyankiwi/gemma-4-31B-it-AWQ-4bit` (Gemma 4 31B AWQ on :8002) | `LOCAL_API_KEY` + `LOCAL_API_BASE_GEMMA` |

Set `LLM_PROFILE=<key>` in `.env` to switch — that's it, no other vars to flip. If your local server exposes the model under a different name, edit the `model` field of the profile in [API/config.py](API/config.py) (or override at runtime with `AGENT_MODEL`).

To add another LiteLLM-supported provider, append to `_LLM_PROFILES`:

```python
_LLM_PROFILES = {
    # ... existing six ...
    "anthropic": {
        "model": "anthropic/claude-sonnet-4-5",
        "api_key_env": "ANTHROPIC_API_KEY",
        "api_base_env": "",
    },
}
```

**Note**: `ModelSettings()` is bare in this codebase — passing `reasoning_effort` raises `UnsupportedParamsError` on DeepInfra/Gemma. If you want reasoning on a Gemini-class profile, set `litellm.drop_params=True` at module load.

## API Endpoints

### `GET /health`

Health check with agent status.

**Response**:
```json
{
  "status": "healthy",
  "service": "knowledge-robot",
  "version": "1.0.0",
  "agent_ready": true,
  "model": "deepinfra/google/gemma-4-31B-it"
}
```

### `POST /api/process-row`

Process a single CSV row.

**Request**:
```json
{
  "row_data": {
    "customer_name": "Alice",
    "review": "Great product!"
  },
  "prompt": "Analyze {customer_name}'s review: {review}",
  "output_schema": [
    {"name": "sentiment", "type": "text", "description": "Overall sentiment"},
    {"name": "score", "type": "number", "description": "Numeric score 0-100"}
  ],
  "scrape_backend": "local",
  "enable_search": false,
  "browser_visible": false
}
```

**Fields**:
- `scrape_backend` — `"local"` (default) or `"firecrawl"`. Validated server-side; `"none"` is rejected with HTTP 400.
- `enable_search` — adds `firecrawl_search` (firecrawl backend) or `search_google` (local backend) to the agent's tool list.
- `browser_visible` — only honored when `scrape_backend=local` AND `browser_visible_supported=true` (host run, or WSLg overlay). Otherwise silently downgraded to headless.

Old clients that send only `enable_search` (no `scrape_backend`) keep working — they default to `local`.

**Response**:
```json
{
  "output": {
    "sentiment": "positive",
    "score": 95,
    "_processed_at": "2025-01-10T12:34:56.789Z"
  },
  "metadata": {
    "processing_time_ms": 5432,
    "row_data_received": true,
    "schema_fields_count": 2
  }
}
```

**Error Response** (400):
```json
{
  "status": "error",
  "error": "row_data is required"
}
```

#### Response contract (load-bearing for consumers)

These guarantees are stable and apply to every consumer that calls `POST /api/process-row`:

- **2xx response shape:** `{ output: { ...schema_fields, _processed_at: "<ISO timestamp>" }, metadata: { processing_time_ms: <int>, row_data_received: true, schema_fields_count: <int> } }`. The top-level `output` key is part of the contract — it will not be renamed to `data`, `result`, or `payload`. `metadata.processing_time_ms` is currently always emitted and intended for logging / observability.
- **Underscore-prefix metadata convention:** any key inside `output` that starts with `_` (today only `_processed_at`) is reserved for backend-controlled metadata. Consumers should strip underscore-prefixed keys before presenting results to end users — the official frontend already does this. Future internal metadata may be added under additional `_*` keys without being a breaking change.
- **Error response shape (any non-2xx):** `{ status: "error", error: "<message>", details?: "<optional details>" }`. Consumers should read `body.error` and rely on `response.ok` rather than depending on specific status codes (the 4xx vs 5xx split is not contractual).
- **Field defaults when omitted from the request:** `enable_search` → `false`, `scrape_backend` → `"local"`, `browser_visible` → `false`. These defaults are stable.
- **Runtime tunables are backend env vars only** — `AGENT_MAX_TURNS`, `AGENT_SUBAGENT_MAX_TURNS`, `TOOL_OUTPUT_MAX_CHARS`, `FIRECRAWL_MAX_CONTENT_LENGTH`, `MCP_*`, etc. are configured per-deployment via `.env` and will not migrate into the request body. If a consumer needs per-request overrides for any of these, file an issue first — we won't silently route them through the wire protocol.

### `GET /api/agent-status`

Get agent configuration + capabilities. The frontend hits this on mount to discover which scrape backends are available and whether the visible-browser checkbox should be enabled.

**Response**:
```json
{
  "litellm_model_initialized": true,
  "model": "deepinfra/google/gemma-4-31B-it",
  "llm_profile": "deepinfra",
  "firecrawl_configured": true,
  "running_in_docker": true,
  "browser_visible_supported": false,
  "available_scrape_backends": ["local", "firecrawl"],
  "max_tool_calls": 15,
  "content_truncation_limit": 20000
}
```

`available_scrape_backends` always includes `"local"`. `"firecrawl"` is appended only when `FIRECRAWL_API_KEY` is set. `browser_visible_supported` is `true` on host runs and inside the WSLg overlay; `false` in plain Docker.

## Key Components

### 1. Orchestrator (`dynamic_agent.py`)

Module-level `process_row()` validates the request, builds the dynamic Pydantic model, and delegates to `agent.run_agent(...)`. Also exposes `get_agent_status()` for the API.

### 2. Agent factory + dispatcher (`agent.py`)

- `set_tracing_disabled(disabled=True)` at module load (silences OpenAI tracing service spam).
- `_create_model()` returns a `LitellmModel` from `settings.resolved_agent_model` + `settings.resolved_api_key`, plus `base_url=settings.resolved_api_base` when the active profile defines an `api_base_env` (used by `local` / `local_gemma`).
- `_build_instructions(user_task, output_schema, scrape_backend)` returns the system prompt — branches by backend.
- `_run_firecrawl(...)` and `_run_local(...)` build the Agent with the right tool list and run it. Both end with `StopAtTools(["submit_result"])`.
- `run_agent(...)` is the public dispatcher; raises `ValueError` for anything other than `"firecrawl"` / `"local"`.

### 3. Tools (`tools/`)

- **`submit.py`** — `make_submit_result(model_class)` factory. Returns a `@function_tool` whose argument type is the dynamic Pydantic model. Body: `return result.model_dump_json()`. This is the terminal tool.
- **`firecrawl.py`** — `get_firecrawl_mcp(enable_search)` returns an `MCPServerStreamableHttp` with a tool filter (only `firecrawl_scrape`, plus `firecrawl_search` when search is on). `TruncatingMCPWrapper` intercepts `call_tool` to:
  1. Sanitize args (strip hallucinated keys),
  2. Catch MCP exceptions (return error text instead of raising),
  3. 90/10-truncate large content.
- **`local.py`** — Playwright-driven `search_google` (Google SERP scrape) + crawl4ai-backed `visit_webpage`. Module-level `_browser` and `_crawl_browser` refs set by `_run_local` before `Runner.run`.
- **`subagent.py`** — `delegate_to_subagent(task)` builds a fresh agent in its own context. `contextvars`-tracked depth (`_MAX_DEPTH = 1`).

### 4. Browser modules

- **`browser.py`** — `BrowserManager(session_dir, visible)` — Playwright `launch_persistent_context`. `--no-sandbox` when in Docker.
- **`crawl_browser.py`** — `CrawlBrowserManager` wrapping `AsyncWebCrawler` for clean markdown extraction.

### 5. Configuration (`config.py`)

`Settings(BaseSettings)` from `pydantic-settings`. Reads `.env` once at import. Singleton `settings` exposed via `get_config()` shim. Computed properties:
- `resolved_agent_model` — `agent_model` override OR `_LLM_PROFILES[llm_profile]["model"]`
- `resolved_api_key` — env var named by `_LLM_PROFILES[llm_profile]["api_key_env"]`
- `resolved_api_base` — `agent_api_base` override OR env var named by `_LLM_PROFILES[llm_profile]["api_base_env"]` (empty for cloud profiles, set for `local` / `local_gemma`)
- `running_in_docker` — checks `/.dockerenv` or `RUNNING_IN_DOCKER=true`
- `browser_visible_supported` — true on host, true in WSLg overlay, false in plain Docker

### 6. Utils (`utils.py`)

- `create_dynamic_pydantic_model(schema, model_name)` — `pydantic.create_model` from frontend's JSON schema.
- `interpolate_prompt(template, row_data)` — replaces `{column}` placeholders.
- `validate_output_schema(schema)` — schema sanity check.

```python
TYPE_MAPPING = {
    'text':    (str,   ...),
    'number':  (float, ...),
    'boolean': (bool,  ...),
    'date':    (str,   ...),  # ISO format
}
```

### 7. API (`api.py`)

Flask app with CORS, request validation, async/sync bridge (per-request `asyncio.new_event_loop()`), and 400/404/500 handlers. Validates `scrape_backend ∈ {"local", "firecrawl"}` (rejects `"none"` since the new dispatcher doesn't support it).

## Web Search & scrape backends

Web search is a separate per-request flag (`enable_search: bool`). It pairs with whichever scrape backend is active:

| | `enable_search=false` | `enable_search=true` |
|---|---|---|
| **`scrape_backend=local`** | `visit_webpage`, `delegate_to_subagent`, `submit_result` | + `search_google` |
| **`scrape_backend=firecrawl`** | `firecrawl_scrape` only (via tool_filter) | + `firecrawl_search` |

### Why search is sometimes brittle on local

`search_google` is a Playwright-driven Google SERP scrape. Google blocks bot-like patterns. For long batches with many search calls, prefer `scrape_backend=firecrawl + enable_search=true` — Firecrawl's managed search is more reliable.

### Agent instructions snippet (firecrawl backend)

```
IMPORTANT - Tool Usage:
- firecrawl_scrape: Always use formats: ["markdown"] only.
- firecrawl_search: Call with {"query": "...", "limit": 10}. Do NOT include scrapeOptions.
```

Agent discovers tools automatically via MCP - we only document what NOT to do.

## Content Truncation

Firecrawl results can be very large. The `TruncatingMCPWrapper` prevents token overflow:

- **Max length**: 20,000 characters (~5,000 tokens) by default
- **Strategy**: Keep 90% from start (main content), 10% from end (footer links)
- **Logging**: Tracks truncation statistics for monitoring

**Example log**:
```
Truncated firecrawl_scrape output: 45,230 → 20,000 chars (55.8% reduction)
```

## Performance Tuning

### For Faster Processing

- Reduce `AGENT_MAX_TURNS` (fewer LLM rounds)
- Lower `FIRECRAWL_MAX_CONTENT_LENGTH` (less content to process)
- Disable search when not needed (`enable_search=false`)
- Use `scrape_backend=local` for free, parallel scraping (no Firecrawl API cost or rate limit)

### For Better Quality

- Increase `AGENT_MAX_TURNS` (more thorough research)
- Raise `FIRECRAWL_MAX_CONTENT_LENGTH` (more context per page)
- Enable search for discovery tasks (use `scrape_backend=firecrawl + enable_search=true` for reliable search)

### Concurrency

- Default `KNOWLEDGE_ROBOT_THREADS=16` covers `concurrent_runs=10` in the UI without queueing.
- Bump `KNOWLEDGE_ROBOT_WORKERS` cautiously — each worker has its own browser context (memory cost in local mode).

## Troubleshooting

### Agent Not Initializing

**Symptom**: `agent_ready: false` in health check
**Causes**:
- `LLM_PROFILE` set to a profile not in `_LLM_PROFILES`
- The profile's API key env var is empty (e.g. `DEEPINFRA_API_KEY` missing)
- Network issues reaching the provider

**Fix**:
```bash
# Verify keys are set
docker exec knowledge-robot-backend-1 sh -c 'echo $LLM_PROFILE; echo $DEEPINFRA_API_KEY'

# Smoke test the model directly via LiteLLM (inside the container)
docker exec knowledge-robot-backend-1 python -c "
from agents.extensions.models.litellm_model import LitellmModel
m = LitellmModel(model='deepinfra/google/gemma-4-31B-it', api_key='$DEEPINFRA_API_KEY')
print('OK')
"
```

### Tool Call Failures

**Symptom**: Errors mentioning MCP or Firecrawl in `scrape_backend=firecrawl` mode
**Causes**:
- Firecrawl API rate limits
- Invalid URLs (agent hallucinated one)
- Slow target site

**Fix**:
- Check Firecrawl dashboard for rate limits
- Bump `MCP_CLIENT_TIMEOUT=60` if scrapes consistently take >20s
- Verify MCP server is reachable from the container

For `scrape_backend=local` mode failures, check Playwright logs (`docker logs knowledge-robot-backend-1`). Common causes: site blocks bots, JS-heavy site never reaches `networkidle`, or CAPTCHA. With visible browser enabled, the user can clear the CAPTCHA manually.

### Parsing Errors

**Symptom**: `Failed to parse submit_result output` in logs, or all-`null` rows in the response
**Causes**:
- Agent didn't call `submit_result` (hit `agent_max_turns` first)
- Agent passed malformed JSON to `submit_result` (rare with Pydantic-bound tool)

**Fix**:
- Simplify output schema (fewer fields, clearer descriptions)
- Increase `AGENT_MAX_TURNS`
- Check the agent's last LLM message in logs — usually reveals what went wrong

### Slow Processing

**Symptom**: Long processing times (>2 min/row)
**Causes**:
- Many search results being scraped sequentially
- Slow target sites (cold starts, anti-bot delays)
- Cold Chromium launch (~2s on first row)

**Fix**:
- Lower `AGENT_MAX_TURNS`
- Reduce `FIRECRAWL_MAX_CONTENT_LENGTH`
- Disable search if not needed

### `UND_ERR_HEADERS_TIMEOUT` from Next.js proxy

**Symptom**: Frontend shows error rows even though backend log says HTTP 200
**Cause**: Backend was queued behind gunicorn workers when undici's headersTimeout fired.
**Fix**: Already mitigated by default — `KNOWLEDGE_ROBOT_THREADS=16` and the proxy's undici dispatcher with 5-min timeouts. If you still hit it, raise `PROCESS_ROW_TIMEOUT_MS` in the frontend env.

## Production Checklist

- [ ] Set `LLM_PROFILE` and the matching API key env var
- [ ] Set `FIRECRAWL_API_KEY` if `scrape_backend=firecrawl` will be used
- [ ] Configure appropriate threads/workers (`KNOWLEDGE_ROBOT_THREADS`, `KNOWLEDGE_ROBOT_WORKERS`)
- [ ] Set reasonable timeout (`KNOWLEDGE_ROBOT_TIMEOUT`)
- [ ] Enable New Relic monitoring (if applicable)
- [ ] Configure logging level (`DEBUG_MODE=false`)
- [ ] Set up health check monitoring (`/health`)
- [ ] Configure CORS for specific frontend domain (`ALLOWED_ORIGINS`)
- [ ] Set up error alerting
- [ ] Document backup/recovery procedures

## Monitoring

### Key Metrics

- **Processing time**: `metadata.processing_time_ms`
- **Tool calls**: Number of Firecrawl operations
- **Truncation rate**: How often content is truncated
- **Error rate**: Failed requests vs total
- **Token usage**: Monitor LLM API costs

### Logs

**Info level**:
- Request received with row/schema counts
- Processing complete with timing
- Content truncation summaries

**Debug level**:
- Full interpolated prompts
- Agent instructions
- Parsing results
- Tool call details

### Health Checks

Monitor `/health` endpoint:
- `status`: Should be "healthy"
- `agent_ready`: Should be `true`
- Response time: Should be <1s

## Tests

The backend ships with a pytest suite covering pure-function utilities, the
contextvars browser-isolation invariant, the Firecrawl wrapper's sanitization /
truncation / error-catching, the `submit_result` factory, and the Flask wire
protocol. All tests are fast (<5s), offline (no LLM calls, no real Playwright,
no real Firecrawl), and self-contained — see [`tests/`](tests/) and
[`pyproject.toml`](pyproject.toml).

### Run locally

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest tests/ -v
```

### What's covered

| Test file | Pins |
|-----------|------|
| `test_local_contextvars.py` | The browser-handle isolation across concurrent asyncio tasks. **Regression test for the module-global → `ContextVar` migration in `tools/local.py`.** |
| `test_utils.py` | `create_dynamic_pydantic_model`, `interpolate_prompt`, `validate_output_schema` — all the pure helpers. |
| `test_firecrawl_wrapper.py` | `_sanitize_arguments` strips hallucinated keys; `TruncatingMCPWrapper` truncates long content (90% head + 10% tail) and catches MCP exceptions instead of raising. |
| `test_submit.py` | `make_submit_result` factory builds a `submit_result` tool whose argument type is the dynamic Pydantic model. |
| `test_api_contract.py` | Flask test client: `/health`, `/api/agent-status`, `POST /api/process-row` happy path + every documented 4xx case + `X-API-Key` auth flow. The agent runtime is monkeypatched so no LLM credits are needed. **Pins the response contract** documented above. |

### What's NOT covered (yet)

- Frontend tests (no test runner installed; Vitest + jsdom + RTL setup is its own follow-up project).
- Real-Playwright integration tests (would require headless Chromium in CI).
- Real-LLM end-to-end tests (would burn LLM credits in CI).

### CI

[`.github/workflows/test.yml`](../.github/workflows/test.yml) runs the suite on
every push and pull request to `master`. Green is required before merge.

### Manual smoke checks (still useful)

```bash
# Health
curl http://localhost:8080/health

# Process a row (replace API key + body)
curl -X POST http://localhost:8080/api/process-row \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

### Adding New Features

1. **New tool support**: Update `_get_tool_filter()` in `dynamic_agent.py`
2. **New output types**: Add to `TYPE_MAPPING` in `utils.py`
3. **New endpoints**: Add to `api.py` with validation
4. **New config**: Add to `Config` class in `config.py`

## Security

- **API Keys**: Never commit to git, use environment variables
- **CORS**: Configure for specific domains in production
- **Input Validation**: All inputs validated before processing
- **Error Messages**: Don't expose internal details in production
- **Rate Limiting**: Consider adding rate limiting for public APIs

## License

MIT
