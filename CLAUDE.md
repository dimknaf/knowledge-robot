# Claude Code Guide — Knowledge Robot

This document helps Claude Code (and human developers) understand and work with the Knowledge Robot codebase effectively.

## Project Overview

**Name**: Knowledge Robot
**Purpose**: An agentic AI that automates the repetitive work knowledge workers do every day — web research, browsing, data extraction, and structured note-taking. The user describes the task once, defines the shape of the output, and the agent runs it across many inputs.
**Architecture**: Next.js frontend + Python Flask backend
**Key Technology**: OpenAI Agents SDK + LiteLLM, Model Context Protocol (MCP), Playwright + crawl4ai (local scrape backend), Firecrawl MCP (managed scrape backend)

### What It Does

The agent receives one input row at a time, runs an LLM loop that can call tools (web search, page scrape, sub-agent delegation), and terminates by calling a `submit_result` tool whose argument type is a Pydantic model generated from the user-defined schema. The result is structured JSON matching that schema. The bundled UI ships with a CSV-driven flow — upload a CSV, write a prompt with `{column_name}` placeholders, define output fields, and watch results stream in — but the backend is a plain HTTP API that accepts any row-shaped JSON, so other input adapters can be built on top.

### LLM provider

Profile-driven via `LLM_PROFILE` env var. Default profile is `deepinfra` running `deepinfra/google/gemma-4-31B-it`. Adding a provider is one entry in `_LLM_PROFILES` in [backend/API/config.py](backend/API/config.py) — no other code changes. The previous Gemini-direct setup is gone; LiteLLM is the only path now.

## Repository Structure

```
knowledge-robot/
├── frontend/                 # Next.js 15 + React 19 + TypeScript
│   ├── app/
│   │   ├── api/
│   │   │   └── process-row/
│   │   │       └── route.ts # API proxy (server-side, keeps API key hidden)
│   │   ├── page.tsx         # Main application (state management, worker pool)
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Tailwind styles
│   ├── app/
│   │   ├── api/
│   │   │   ├── process-row/route.ts   # Proxy POST → backend (undici Agent dispatcher, 5-min timeout)
│   │   │   └── agent-status/route.ts  # Proxy GET → backend (capability discovery)
│   │   ├── page.tsx           # Main app: state, worker pool, capability fetch
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Tailwind styles
│   ├── components/
│   │   ├── FileUpload.tsx     # CSV drag-drop upload
│   │   ├── ColumnTags.tsx     # Clickable column references
│   │   ├── DataPreview.tsx    # CSV table preview
│   │   ├── PromptBuilder.tsx  # Prompt + Local/Firecrawl segmented control
│   │   │                      # + Web Search toggle + Show browser window toggle
│   │   ├── OutputSchemaBuilder.tsx  # Dynamic schema definition
│   │   ├── ProfileManager.tsx       # Save/load profiles (with auto-migration)
│   │   ├── ExecutionControls.tsx    # Concurrency & settings
│   │   ├── ResultsTable.tsx   # Live results — columns derived from schema
│   │   └── ExportButton.tsx   # CSV export
│   ├── lib/
│   │   ├── mockBackend.ts     # processRow + getAgentCapabilities, AbortSignal.timeout(300s)
│   │   ├── profileUtils.ts    # Profile validation, legacy enableSearch migration
│   │   └── csvParser.ts       # PapaParse utilities
│   ├── types/index.ts         # TypeScript interfaces (ScrapeBackend, AgentCapabilities, …)
│   ├── package.json           # Dependencies (incl. undici)
│   └── README.md              # Frontend documentation
│
├── backend/                  # Python Flask + Agents SDK + LiteLLM + MCP + Playwright
│   ├── API/
│   │   ├── api.py             # Flask REST API (3 endpoints)
│   │   ├── dynamic_agent.py   # Thin orchestrator (~80 lines) — calls agent.run_agent
│   │   ├── agent.py           # Factory + dispatcher (firecrawl vs local)
│   │   ├── browser.py         # Playwright BrowserManager (local backend)
│   │   ├── crawl_browser.py   # crawl4ai AsyncWebCrawler wrapper (local backend)
│   │   ├── config.py          # pydantic-settings + _LLM_PROFILES dict
│   │   ├── utils.py           # Dynamic Pydantic model + prompt interpolation
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── submit.py      # make_submit_result(model_class) terminal tool
│   │   │   ├── firecrawl.py   # TruncatingMCPWrapper (sanitize + truncate + catch)
│   │   │   ├── local.py       # search_google + visit_webpage Playwright tools
│   │   │   └── subagent.py    # delegate_to_subagent (depth cap = 1)
│   │   └── run.sh             # Gunicorn startup
│   ├── .env                   # Environment variables (not in git)
│   ├── requirements.txt       # Python deps (Playwright + crawl4ai + pydantic-settings)
│   ├── Dockerfile             # Container build (installs Chromium + deps)
│   └── README.md              # Backend documentation
│
├── docker-compose.yml         # Base Docker Compose (no ports, no host paths)
├── docker-compose.local.yml   # Local development overlay (binds 3000 + 8080)
├── docker-compose.windowed.yml  # WSLg overlay — visible Chromium on Win11 desktop
├── .env.local.example         # Example env for local development
├── README.md                  # OSS entry point
├── LICENSE                    # Apache 2.0
├── NOTICE                     # Apache 2.0 attribution
├── USER_GUIDE.md              # User-facing documentation
└── CLAUDE.md                  # This file (dev guide)
```

## Architecture Deep Dive

### Frontend Architecture

**Framework**: Next.js 15 with App Router and Turbopack
**State Management**: React hooks (`useState`, `useCallback`) in `page.tsx`
**Styling**: Tailwind CSS 4 (utility-first)
**CSV Parsing**: PapaParse library

**Key Flow**:
1. On mount, `page.tsx` fetches `/api/agent-status` to discover available scrape backends and `browser_visible_supported`. UI greys unsupported options accordingly.
2. User uploads CSV → `FileUpload` parses with PapaParse.
3. `ColumnTags` display clickable column names.
4. User builds prompt in `PromptBuilder` and picks: scrape backend (Local / Firecrawl), Web Search on/off, Show browser window on/off.
5. User defines output schema in `OutputSchemaBuilder`.
6. `ProfileManager` saves/loads JSON profiles. Legacy profiles (with only `enableSearch`) auto-migrate to `scrapeBackend = 'local'`.
7. User clicks "Start" in `ExecutionControls`.
8. Worker pool processes rows concurrently. Each row POSTs to `/api/process-row` which proxies to the backend.
9. `ResultsTable` shows live updates. **Output columns are derived from the schema** (not from `results[0].outputData`) so they appear immediately under high concurrency.
10. `ExportButton` generates CSV of results.

**Worker Pool Pattern** (`page.tsx:140-159`):
- Maintains N concurrent workers (user-configurable 1-10)
- Each worker processes rows sequentially
- Uses `AbortController` for cancellation
- Updates state after each row completion

### Backend Architecture

**Framework**: Flask + Gunicorn (16 threads, 1 worker by default)
**Agent runtime**: `openai-agents[litellm]` — `Agent`, `Runner`, `@function_tool`, `StopAtTools`, `MCPServerStreamableHttp`
**LLM provider**: LiteLLM via `LitellmModel` adapter, profile-driven (`LLM_PROFILE=deepinfra` → `deepinfra/google/gemma-4-31B-it`)
**Scrape backends (per-request)**:
  - `local` (default): Playwright (`search_google`) + crawl4ai (`visit_webpage`). Chromium baked into image.
  - `firecrawl`: Firecrawl MCP server (`firecrawl_scrape`, `firecrawl_search`).
**Termination**: agent calls `submit_result(MyDynamicModel)` terminally; `StopAtTools(["submit_result"])` halts the runner. **Single LLM round per agentic loop** — no second parse call.

**HTTP contract:** the load-bearing wire-protocol guarantees (request shape, response shape, underscore-metadata convention, error shape, default values, what's NOT in the wire protocol) are documented in [backend/README.md → Response contract](backend/README.md#response-contract-load-bearing-for-consumers). External consumers should treat that section as the source of truth.

**Key Flow** (one row):
1. `POST /api/process-row` receives `row_data`, `prompt`, `output_schema`, `scrape_backend`, `browser_visible`, `enable_search`.
2. `interpolate_prompt()` replaces `{column}` with row values.
3. `create_dynamic_pydantic_model()` builds an `AnalysisOutput` Pydantic class from the schema.
4. `make_submit_result(AnalysisOutput)` produces a `@function_tool` whose argument type is the dynamic class — this is the terminal tool.
5. `agent.run_agent(...)` dispatches to `_run_firecrawl` or `_run_local` based on `scrape_backend`.
6. The runner loops up to `agent_max_turns=15` until the agent calls `submit_result`.
7. `OutputModel.model_validate_json(result.final_output)` parses the JSON. On parse failure → `{name: None for name in schema}` fallback (never bubble parse errors up).
8. Return JSON with `_processed_at` timestamp.

**`TruncatingMCPWrapper`** (in [backend/API/tools/firecrawl.py](backend/API/tools/firecrawl.py)) — three responsibilities:
  - **Argument sanitization**: Gemma hallucinates `scrapeOptions`. Force-strip `firecrawl_scrape` to `{url, formats: ["markdown"]}` and `firecrawl_search` to `{query, limit?}`.
  - **Error catching**: `try/except` around `server.call_tool()`; on exception return a `CallToolResult(content=[TextContent(text="Error: ...")])` so `StopAtTools` machinery doesn't crash.
  - **Content truncation**: 90% head + 10% tail, capped at `firecrawl_max_content_length` (default 20K).

**`delegate_to_subagent`** (in [backend/API/tools/subagent.py](backend/API/tools/subagent.py)) — fresh agent in its own context. Module-level depth cap `_MAX_DEPTH = 1` enforced via `contextvars`. Subagent inherits `enable_search` from the parent.

**Display awareness**: `_run_local` checks `settings.browser_visible_supported`. In plain Docker (no WSLg overlay) it forces headless even if the request asks for `browser_visible=true`. Chromium gets `--no-sandbox` whenever `running_in_docker=true`.

### Data Flow (End-to-End)

```
Frontend CSV Upload
  ↓
User Configures (prompt, schema, search toggle)
  ↓
Optional: Save Profile (JSON file)
  ↓
Click "Start Processing"
  ↓
Worker Pool (N concurrent)
  ↓
For Each Row:
  - Interpolate prompt template with row values
  - Call POST /api/process-row (Next.js API route)
    ↓
  Next.js Server (API Proxy):
    - Adds API key header (server-side only)
    - Forwards to Python backend
    ↓
  Backend:
    - Generate Pydantic model from schema
    - Build submit_result tool bound to that model
    - Dispatch to Local (Playwright + crawl4ai) or Firecrawl MCP
    - Agent runs until it calls submit_result; StopAtTools halts the loop
    - Parse submit_result JSON via OutputModel.model_validate_json
    ↓
  - Update ResultsTable with status
    ↓
All Rows Complete
  ↓
Export to CSV
```

### API Proxy Pattern

The frontend uses a Next.js API route to proxy requests to the backend. This keeps sensitive credentials server-side:

```
Browser → /api/process-row (Next.js) → Backend (Python)
           ↑                            ↑
           No API key visible           API key added here
           in browser                   (server-side only)
```

**Files**:
- `frontend/app/api/process-row/route.ts` - Proxy endpoint
- `frontend/lib/mockBackend.ts` - Calls `/api/process-row`

**Environment variables** (server-side only):
- `BACKEND_URL` - Backend service URL (default: `http://backend:8080`)
- `API_SECRET_KEY` - API key for backend authentication

## Key Design Patterns

### 1. Dynamic Schema Generation

**Problem**: Frontend defines arbitrary output schemas
**Solution**: Generate Pydantic models at runtime

```python
# utils.py
def create_dynamic_pydantic_model(output_fields):
    field_definitions = {}
    for field in output_fields:
        field_type, default = TYPE_MAPPING[field['type']]
        field_definitions[field['name']] = (field_type, Field(...))
    return create_model('DynamicOutput', **field_definitions)
```

### 2. Prompt Interpolation

**Problem**: User prompts reference CSV columns
**Solution**: Replace `{column_name}` with actual values

```python
# utils.py
def interpolate_prompt(template, row_data):
    for key, value in row_data.items():
        template = template.replace(f"{{{key}}}", str(value))
    return template
```

### 3. Hardened MCP Wrapper

**Problem**: small models hallucinate extra params (`scrapeOptions`); MCP exceptions can crash `StopAtTools`; Firecrawl results can exceed token limits.
**Solution**: `TruncatingMCPWrapper` — delegate pattern with three responsibilities.

```python
# tools/firecrawl.py
class TruncatingMCPWrapper:
    async def call_tool(self, tool_name, arguments):
        sanitized = _sanitize_arguments(tool_name, arguments)  # strip hallucinated keys
        try:
            result = await self.server.call_tool(tool_name, sanitized)
        except Exception as e:
            return CallToolResult(content=[TextContent(type="text", text=f"Error: {e}")])
        if hasattr(result, "content") and result.content:
            item = result.content[0]
            if hasattr(item, "text") and len(item.text) > self.max_length:
                item.text = self._truncate_content(item.text)  # 90% head + 10% tail
        return result
```

### 4. Per-request scrape backend dispatch

**Problem**: different rows need different scraping (free local vs. paid Firecrawl).
**Solution**: `agent.run_agent(scrape_backend, ...)` dispatches per request. Tool list and instructions are built fresh each time.

```python
# agent.py
if scrape_backend == "firecrawl":
    return await _run_firecrawl(...)
if scrape_backend == "local":
    return await _run_local(...)
raise ValueError(f"Unknown scrape_backend: {scrape_backend}")
```

The frontend calls `/api/agent-status` on mount to discover which backends are available; UI greys out anything missing.

### 5. `submit_result` terminal tool

**Problem**: dynamic output schema needs structured output; `response_format=DynamicModel` is rejected by Gemini-class models when used with tools.
**Solution**: agent calls a tool whose argument type IS the dynamic Pydantic model. `StopAtTools(["submit_result"])` halts the runner.

```python
# tools/submit.py
def make_submit_result(model_class):
    @function_tool
    async def submit_result(result: model_class) -> str:
        return result.model_dump_json()
    return submit_result
```

The runner's `result.final_output` is the JSON. We `OutputModel.model_validate_json(...)` and fall back to `{name: None}` if parsing fails — never bubble parse errors to callers.

### 6. Profile Validation & Migration

**Problem**: Loaded profiles might be corrupted; old profiles use the legacy `enableSearch`-only shape.
**Solution**: Strict validation in [frontend/lib/profileUtils.ts](frontend/lib/profileUtils.ts), with auto-migration. New shape: `{prompt, outputFields, scrapeBackend, enableSearch, browserVisible, version, createdAt}`. Legacy profiles missing `scrapeBackend` are migrated to `'local'` (the new default). `enableSearch` is preserved verbatim if present.

```typescript
// profileUtils.ts
export function validateProfile(data: unknown): Profile {
  // ...validate name, prompt, outputFields, version, createdAt
  // If scrapeBackend missing → default to 'local'
  // If enableSearch missing → default to false
  // If browserVisible missing → default to false
}
```

## Common Development Tasks

### Adding a New Output Field Type

**Files to modify**:
1. `backend/API/utils.py` - Add to `TYPE_MAPPING`
2. `frontend/types/index.ts` - Add to `FieldType` union
3. `frontend/components/OutputSchemaBuilder.tsx` - Add `<option>` in select

### Adding a New MCP Tool

**Files to modify**:
1. `backend/API/dynamic_agent.py`:
   - Update `_get_tool_filter()` to allow new tool
   - Update `_build_instructions()` in `agent.py` to document constraints

### Adding a New API Endpoint

**Files to modify**:
1. `backend/API/api.py` - Add Flask route with validation
2. `frontend/lib/mockBackend.ts` - Add fetch wrapper function

### Adding a New Frontend Component

**Process**:
1. Create `frontend/components/ComponentName.tsx`
2. Define props interface
3. Use TypeScript + Tailwind CSS
4. Import types from `@/types`
5. Add to `frontend/app/page.tsx` if page-level

### Modifying Agent Instructions

**File**: [backend/API/agent.py](backend/API/agent.py)
**Function**: `_build_instructions(user_task, output_schema, scrape_backend)`

**Guidelines**:
- Keep instructions minimal — the agent discovers tools from the SDK runtime.
- Only document constraints (what NOT to do) and the expected `submit_result` schema.
- Branch by `scrape_backend` for backend-specific guidance (firecrawl vs local).
- Mention `submit_result` is terminal (called exactly once) — `StopAtTools` enforces this.

## Environment Setup

### Option 1: Docker Compose (Recommended)

```bash
# Copy example env and add your API keys
cp .env.local.example backend/.env
# Edit backend/.env with LLM_PROFILE=deepinfra, DEEPINFRA_API_KEY=..., FIRECRAWL_API_KEY=...

# Build and run both services
docker-compose -f docker-compose.local.yml up --build

# Access at http://localhost:3000/
# (set NEXT_PUBLIC_BASE_PATH=/knowledge before build to serve under /knowledge instead)
```

For a **visible Chromium window** during local-mode runs on Windows 11, stack the WSLg overlay
**from inside WSL2** (Docker Desktop's VM doesn't see WSLg sockets when invoked from Git Bash/PowerShell):

```bash
wsl -- bash -c 'cd /mnt/c/Users/.../knowledge-robot && \
  docker-compose -f docker-compose.local.yml -f docker-compose.windowed.yml up -d'
```

### Option 2: Manual Setup

**Frontend**:
```bash
cd frontend
npm install

# Create .env.local with server-side vars
cat > .env.local << EOF
BACKEND_URL=http://localhost:8080
API_SECRET_KEY=
EOF

npm run dev
```

**Backend** (host run — useful for headed Chromium without WSLg):
```bash
cd backend
pip install -r requirements.txt
playwright install chromium

# Create .env file
cat > .env << EOF
LLM_PROFILE=deepinfra
DEEPINFRA_API_KEY=your-deepinfra-key
FIRECRAWL_API_KEY=your-firecrawl-key
DEBUG_MODE=true
EOF

cd API
python api.py
```

When running on host, `running_in_docker=false` so `browser_visible=true` is honored
natively — pop a Chromium window without any compose-overlay plumbing.

## Testing Strategy

### Frontend Testing

**Manual testing**:
1. Upload `frontend/sample-data3.csv`
2. Build prompt: `Analyze {company_name} (company number: {company_number})`
3. Add output fields: `analysis` (text), `risk_score` (number)
4. Toggle web search on/off
5. Set concurrent runs to 2
6. Start processing
7. Verify results in table
8. Export CSV

**Console logging**:
- Check browser console for API requests/responses
- Monitor network tab for timing

### Backend Testing

**Health check**:
```bash
curl http://localhost:8080/health
```

**Process row**:
```bash
curl -X POST http://localhost:8080/api/process-row \
  -H "Content-Type: application/json" \
  -d '{
    "row_data": {"company_name": "Test Co", "company_number": "12345"},
    "prompt": "Analyze {company_name}",
    "output_schema": [{"name": "analysis", "type": "text"}],
    "scrape_backend": "local",
    "enable_search": false,
    "browser_visible": false
  }'
```

`scrape_backend` defaults to `"local"`; `enable_search` and `browser_visible` default to `false`. Old clients that only send `enable_search` still work — they get `scrape_backend = "local"` automatically.

**Capabilities**:
```bash
curl http://localhost:8080/api/agent-status
# Returns: { available_scrape_backends, browser_visible_supported, model, llm_profile, ... }
```

**Check logs**:
- Processing time
- Tool calls
- Truncation stats
- Any errors

## Debugging Tips

### Frontend Issues

**Problem**: Results not updating
**Check**: Browser console for errors, network tab for failed requests

**Problem**: Profile won't load
**Check**: Console for `ProfileValidationError`, verify JSON structure

**Problem**: Slow processing
**Check**: Concurrent runs setting, backend response times

### Backend Issues

**Problem**: Agent not initializing
**Check**: `GET /health` → `agent_ready` should be `true`, verify API keys

**Problem**: Tool call failures
**Check**: Firecrawl API key, rate limits, MCP server connectivity

**Problem**: Parsing errors
**Check**: Output schema complexity, LLM response format, logs for details

### MCP/Firecrawl Issues

**Problem**: Content too large
**Solution**: Reduce `FIRECRAWL_MAX_CONTENT_LENGTH`

**Problem**: Search not working
**Check**: `enable_search` parameter, tool filter logs, MCP server response

## Code Style Guidelines

### Frontend (TypeScript/React)

- **Naming**: PascalCase for components, camelCase for functions/variables
- **Files**: One component per file, match component name
- **Props**: Define interface before component
- **State**: Use `useState` for local, props for lifted state
- **Handlers**: Use `useCallback` for performance
- **Styling**: Tailwind utility classes, responsive mobile-first
- **Icons**: Lucide React library

**Example**:
```typescript
interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function MyComponent({
  value,
  onChange,
  disabled,
}: MyComponentProps) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded"
      />
    </div>
  );
}
```

### Backend (Python)

- **Naming**: snake_case for functions/variables, PascalCase for classes
- **Docstrings**: Use for all public functions/classes
- **Type hints**: Use where helpful (especially function signatures)
- **Logging**: Use structured logging with levels (debug, info, error)
- **Error handling**: Try-except with specific exceptions
- **Async**: Use `async def` for I/O operations

**Example** (current `process_row` signature):
```python
async def process_row(
    row_data: Dict[str, Any],
    prompt_template: str,
    output_schema: List[Dict[str, str]],
    scrape_backend: str = "local",
    browser_visible: bool = False,
    enable_search: bool = False,
) -> Dict[str, Any]:
    """Process a single CSV row.

    Args:
        row_data: CSV row as dictionary.
        prompt_template: Prompt with {column} placeholders.
        output_schema: Output field definitions.
        scrape_backend: "local" (Playwright + crawl4ai) or "firecrawl" (MCP).
        browser_visible: Show Chromium window. Forced false in plain Docker.
        enable_search: Add the search tool to whichever backend is active.

    Returns:
        Structured output matching schema, plus `_processed_at` timestamp.
    """
```

## Important Files to Know

### Frontend

| File | Purpose | Key Functions |
|------|---------|---------------|
| `app/page.tsx` | Main app | State management, worker pool, handlers |
| `components/PromptBuilder.tsx` | Prompt editor | Column tag insertion, search toggle |
| `components/ProfileManager.tsx` | Save/load | Profile I/O, validation UI |
| `app/api/process-row/route.ts` | API proxy | Server-side proxy to backend |
| `lib/mockBackend.ts` | API client | `processRow()` - calls `/api/process-row` |
| `lib/profileUtils.ts` | Validation | `validateProfile()`, `exportProfile()`, `importProfile()` |
| `types/index.ts` | Types | All TypeScript interfaces |

### Backend

| File | Purpose | Key Functions |
|------|---------|---------------|
| `API/dynamic_agent.py` | Thin orchestrator | `process_row()`, `get_agent_status()` |
| `API/agent.py` | Factory + dispatcher | `run_agent()`, `_run_firecrawl()`, `_run_local()`, `_build_instructions()` |
| `API/tools/submit.py` | Terminal tool | `make_submit_result(model_class)` |
| `API/tools/firecrawl.py` | MCP wrapper | `TruncatingMCPWrapper`, `get_firecrawl_mcp()` |
| `API/tools/local.py` | Local Playwright tools | `search_google`, `visit_webpage`, `set_browser`, `set_crawl_browser` |
| `API/tools/subagent.py` | Subagent | `delegate_to_subagent` |
| `API/browser.py` | Playwright wrapper | `BrowserManager` |
| `API/crawl_browser.py` | crawl4ai wrapper | `CrawlBrowserManager` |
| `API/api.py` | REST API | Flask routes, CORS, error handling |
| `API/config.py` | Configuration | Environment variables, validation |
| `API/utils.py` | Utilities | Pydantic generation, prompt interpolation |

## Git Workflow

**Branches**:
- `main` / `master`: Production-ready code
- `improvement2`: Current development branch (from git status)

**Commits**:
- Keep commits focused and atomic
- Write clear commit messages
- Don't commit `.env` files (in `.gitignore`)
- Don't commit `node_modules/` or `__pycache__/`

## Deployment Notes

### Production Deployment (Bring Your Own)

The base `docker-compose.yml` is intentionally generic. To deploy in production, layer your own overlay file on top:

```bash
docker compose -f docker-compose.yml -f docker-compose.your-prod.yml up -d
# or, for Swarm:
docker stack deploy -c docker-compose.yml -c docker-compose.your-prod.yml knowledge-robot
```

Your overlay should add:
- Port mappings (e.g. `3000:3000` for frontend, `8080:8080` for backend)
- Production env vars (LLM keys, `API_SECRET_KEY`, `ALLOWED_ORIGINS`, `NEXT_PUBLIC_BASE_PATH` if serving behind a reverse proxy at a sub-path)
- Resource limits, replicas, secrets — whatever your platform expects

**Key files in this repo**:
- `docker-compose.yml` — base, no ports, shared between dev and prod overlays
- `docker-compose.local.yml` — local development (binds 3000 + 8080 to host)
- `docker-compose.windowed.yml` — WSLg overlay for a visible Chromium window on Windows 11

### Vercel (Alternative)

- Set `BACKEND_URL` and `API_SECRET_KEY` as environment variables (NOT `NEXT_PUBLIC_*`)
- Auto-deploys from git
- Uses production build (`npm run build`)
- Set `NEXT_PUBLIC_BASE_PATH` if you want to serve under a sub-path

## Security Considerations

- **API Keys**: Never commit, always use environment variables
- **API Proxy**: Backend API key is kept server-side via Next.js API route (never exposed to browser)
- **No NEXT_PUBLIC_ secrets**: Never use `NEXT_PUBLIC_` prefix for sensitive values
- **CORS**: Configure for specific domains in production (`ALLOWED_ORIGINS`)
- **Input Validation**: All user inputs validated before processing
- **File Upload**: CSV only, parsed with PapaParse (safe)
- **Profile Loading**: JSON validation prevents code injection
- **Rate Limiting**: Consider adding for public deployments

## Performance Optimization

### Frontend
- **Lazy loading**: Components loaded on-demand
- **Memoization**: Use `useMemo` for expensive computations
- **Debouncing**: For user input handlers
- **Worker pool**: Prevents browser from blocking on many requests

### Backend
- **Threads**: Scale with `KNOWLEDGE_ROBOT_THREADS` (default 16; bumped from 4 to avoid undici headersTimeout under high concurrency)
- **Workers**: `KNOWLEDGE_ROBOT_WORKERS` (default 1; bump cautiously since each worker holds its own browser context)
- **Tool call limits**: Tune `AGENT_MAX_TURNS` (default 15)
- **Subagent budget**: Tune `AGENT_SUBAGENT_MAX_TURNS` (default 30)
- **Content truncation**: Prevents token overflow
- **Async operations**: All I/O is async

## Useful Commands

```bash
# Docker Compose (recommended for local dev)
cp .env.local.example .env                           # Copy env template
docker-compose -f docker-compose.local.yml up --build  # Build and run
docker-compose -f docker-compose.local.yml logs -f     # View logs
docker-compose -f docker-compose.local.yml down        # Stop

# Frontend (manual)
cd frontend
npm install          # Install dependencies
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Check code quality

# Backend (manual)
cd backend
pip install -r requirements.txt    # Install dependencies
cd API && python api.py            # Development server
gunicorn -c gunicorn_config.py api:app  # Production server

# Testing
curl http://localhost:8080/health       # Backend health
curl http://localhost:3000/             # Frontend (or /knowledge/ if NEXT_PUBLIC_BASE_PATH is set)
```

## Resources

- **Next.js Docs**: https://nextjs.org/docs
- **LiteLLM Docs**: https://docs.litellm.ai/
- **MCP Spec**: https://spec.modelcontextprotocol.io/
- **Firecrawl**: https://firecrawl.dev/
- **Pydantic**: https://docs.pydantic.dev/

## Getting Help

1. **Check logs**: Browser console (frontend), terminal (backend)
2. **Read error messages**: They're usually descriptive
3. **Verify environment**: Check `.env` variables
4. **Test components**: Isolate issue to frontend or backend
5. **Review this guide**: Architecture and debugging tips

## Contributing Guidelines

1. **Understand the change**: Read relevant code first
2. **Follow patterns**: Use existing patterns (wrapper, filter, validation)
3. **Test thoroughly**: Manual testing with sample data
4. **Update docs**: Update README if behavior changes
5. **Clean code**: Follow style guidelines above
6. **Commit clearly**: Descriptive messages

---

This guide should help you navigate and modify the Knowledge Robot codebase effectively. When in doubt, check existing code for patterns, or refer to the detailed READMEs in `frontend/` and `backend/` directories.
