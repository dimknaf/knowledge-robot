# Knowledge Robot — Frontend

A Next.js UI that lets non-developers drive the Knowledge Robot agent: build prompts with column placeholders, define the output schema you want back, and watch the agent process inputs in parallel. CSV is the input format the bundled UI ships with — drag a file in, the columns become clickable variables — but the underlying backend API is row-shaped JSON, so other input flows can sit alongside this one.

## Features

- **CSV Upload**: Drag-and-drop or click to upload CSV files
- **Column Tags**: Interactive column tags that can be inserted into prompts as variables
- **Data Preview**: View the first 6 rows of your CSV with full scrolling capability
- **Prompt Builder** with three new toggles:
  - **Scrape backend** segmented control: **Local** (Playwright + crawl4ai) or **Firecrawl** (cloud MCP)
  - **Web search** toggle: adds the search tool to whichever backend is active (`firecrawl_search` / `search_google`)
  - **Show browser window** toggle: opens a real Chromium window during local-mode runs (host or WSLg overlay only)
- **Output Schema Builder**: Define output fields with types (text, number, boolean, date)
- **Capability discovery**: On mount, fetches `/api/agent-status` so unsupported options are auto-greyed
- **Profile Management**: Save and load processing configurations as JSON files
  - Profiles persist `scrapeBackend`, `enableSearch`, `browserVisible`
  - Legacy profiles (`enableSearch`-only) auto-migrate to `scrapeBackend = 'local'`
- **Concurrent Processing**: 1–10 concurrent rows (defaults to 5)
- **Real-time Results**: Live updates with status indicators. Output columns appear immediately because they're derived from the schema, not from the first completed row.
- **Export to CSV**: Download processed results with optional input columns
- **Abort Control**: Stop processing at any time

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Backend API running (see [backend README](../backend/README.md))

### Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

Create `.env.local`:
```bash
# Backend URL — used server-side by the Next.js API proxy routes.
# In Docker compose, this is the service name (http://backend:8080).
BACKEND_URL=http://localhost:8080

# Optional: API key forwarded to the backend by the proxy.
# Leave blank for local dev (backend auth is disabled).
API_SECRET_KEY=

# Optional: per-row timeout (ms) used by the proxy + browser fetch.
# Default 300000 (5 min). Bump if you process slow rows.
# PROCESS_ROW_TIMEOUT_MS=300000
```

These are **server-side** env vars (no `NEXT_PUBLIC_` prefix). The browser never sees `BACKEND_URL` or `API_SECRET_KEY` — both are read by [app/api/process-row/route.ts](app/api/process-row/route.ts) and [app/api/agent-status/route.ts](app/api/agent-status/route.ts).

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build the application for production:

```bash
npm run build
```

### Production

Start the production server:

```bash
npm start
```

## Usage

1. **Upload a CSV file** — Click the upload area or drag and drop a CSV file
2. **Review your data** — Check the column tags and data preview
3. **Build your prompt** — Click column tags to insert them as variables (e.g., `{customer_name}`)
4. **Pick a scrape backend** — Local (default) or Firecrawl
5. **Toggle Web search** (optional) — adds the search tool to the active backend
6. **Toggle Show browser window** (optional) — only available when `browser_visible_supported=true` (host run or WSLg overlay)
7. **Define output schema** — Add output fields with names, types, and descriptions
8. **Save as profile** (optional) — Save your configuration for reuse
9. **Configure execution** — Set concurrent runs (default: 5)
10. **Start processing** — Click "Start Processing"
11. **Monitor progress** — Watch real-time updates; columns appear immediately
12. **Export results** — Download CSV

## Profile Management

### Saving Profiles

1. Configure your prompt and output schema
2. Click "Save Profile"
3. Enter a descriptive name
4. Profile downloads as `profile_<name>_<date>.json`

### Loading Profiles

1. Click "Load Profile"
2. Select a `.json` profile file
3. Prompt, schema, and search settings are automatically populated

### Profile File Format

Profiles are stored as JSON with validation:

```json
{
  "name": "Sentiment Analysis v1",
  "prompt": "Analyze {customer}'s review of {product}...",
  "outputFields": [
    {
      "id": "field-123",
      "name": "sentiment",
      "type": "text",
      "description": "Overall sentiment"
    }
  ],
  "scrapeBackend": "local",
  "enableSearch": false,
  "browserVisible": false,
  "version": "1.0",
  "createdAt": "2025-01-10T12:34:56.789Z"
}
```

**Legacy migration**: Profiles saved before this refactor only have `enableSearch`. Loading them auto-fills `scrapeBackend = "local"` (the new default) and `browserVisible = false`. The `enableSearch` value is preserved.

## Scrape backends

Per-request choice (segmented control in the Prompt Builder):

| | Local (default) | Firecrawl |
|---|---|---|
| Where it runs | Chromium inside the backend container (or host) | Firecrawl MCP cloud service |
| Tools available | `visit_webpage` (+ `search_google` if Web search on) | `firecrawl_scrape` (+ `firecrawl_search` if Web search on) |
| Cost | Free | Per-call API cost |
| Search reliability | Brittle — Google blocks SERP scrapes | Managed, more reliable |
| Visible browser | Optional (host or WSLg overlay) | N/A |
| Auth'd sites / cookies | Possible (persistent user-data-dir) | No |

The **Web search** toggle is orthogonal — it works with both backends and just adds the search tool to whatever backend is active.

The **Show browser window** toggle only applies to Local. When `browser_visible_supported=false` (plain Docker), it's greyed out with a tooltip.

## Technology Stack

- **Framework**: Next.js 15+ (App Router with Turbopack)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 4
- **CSV Parsing**: PapaParse
- **Icons**: Lucide React
- **Validation**: Custom JSON validation utilities
- **React**: 19.1.0

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main application page
│   └── globals.css         # Global styles
├── components/
│   ├── FileUpload.tsx      # CSV file upload
│   ├── ColumnTags.tsx      # Column tag display
│   ├── DataPreview.tsx     # CSV data preview
│   ├── PromptBuilder.tsx   # Prompt input with search toggle
│   ├── OutputSchemaBuilder.tsx  # Output schema definition
│   ├── ProfileManager.tsx  # Profile save/load UI
│   ├── ExecutionControls.tsx    # Processing controls
│   ├── ResultsTable.tsx    # Results display
│   └── ExportButton.tsx    # CSV export
├── lib/
│   ├── csvParser.ts        # CSV parsing and export utilities
│   ├── mockBackend.ts      # Backend API client
│   ├── profileUtils.ts     # Profile validation and I/O
│   └── utils.ts            # Utility functions
└── types/
    └── index.ts            # TypeScript type definitions
```

## API Integration

All backend traffic goes through Next.js proxy routes (server-side; the browser never sees the backend URL or API key).

**`POST /api/process-row`** — proxies to backend `/api/process-row`. Uses an `undici.Agent` dispatcher with 5-min `headersTimeout`/`bodyTimeout` plus an `AbortSignal.timeout(300_000)` upper bound.

**Request body**:
```json
{
  "row_data": {"column1": "value1"},
  "prompt": "Analyze {column1}...",
  "output_schema": [
    {"name": "field1", "type": "text", "description": "..."}
  ],
  "scrape_backend": "local",
  "enable_search": false,
  "browser_visible": false
}
```

**Response**:
```json
{
  "output": {
    "field1": "result",
    "_processed_at": "2026-04-30T12:34:56Z"
  },
  "metadata": {
    "processing_time_ms": 5000,
    "row_data_received": true,
    "schema_fields_count": 1
  }
}
```

On timeout the proxy returns HTTP 504 with a clear "Backend timed out" message; on backend error it forwards the original status + body.

**`GET /api/agent-status`** — proxies to backend `/api/agent-status`. Used by the page on mount to populate `availableBackends` and `browserVisibleSupported`.

```json
{
  "available_scrape_backends": ["local", "firecrawl"],
  "browser_visible_supported": false,
  "model": "deepinfra/google/gemma-4-31B-it",
  "llm_profile": "deepinfra"
}
```

See the [backend README](../backend/README.md) for full API documentation.

## Performance Tips

- **Concurrent Processing**: Start with 2-3 concurrent runs, increase if backend can handle it
- **Web Search**: Only enable when necessary - it adds processing time
- **Output Fields**: Define only the fields you need - fewer fields = faster processing
- **Profiles**: Reuse profiles for consistent results across similar datasets

## Troubleshooting

### Backend Connection Issues
- Verify `BACKEND_URL` is correct (server-side env var, not `NEXT_PUBLIC_*`)
- Check backend is running: `curl http://localhost:8080/health`
- Check browser console + Next.js server logs for proxy errors

### `UND_ERR_HEADERS_TIMEOUT` / "Row timed out"
- The undici dispatcher in [app/api/process-row/route.ts](app/api/process-row/route.ts) sets 5-min timeouts; the same applies to the browser fetch.
- If rows legitimately take longer, raise `PROCESS_ROW_TIMEOUT_MS` (env var on the Next.js server).
- Backend `KNOWLEDGE_ROBOT_THREADS=16` should keep gunicorn from queueing; lower concurrency in the UI if you see queue waits.

### File Upload Issues
- Ensure CSV is properly formatted with headers
- Check file size (very large files may cause browser issues)
- Verify column names don't have special characters

### Profile Loading Errors
- Ensure profile file is valid JSON
- Check profile version is compatible
- Verify all required fields are present

## Future Enhancements

- Batch processing of multiple CSV files
- Advanced filtering and sorting of results
- Result caching for repeated analyses
- Custom column transformations
- Support for Excel and other file formats
- Collaborative profile sharing

## Deploy on Vercel

The easiest way to deploy is using the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

**Environment Variables to Set** (server-side only — no `NEXT_PUBLIC_` prefix):
- `BACKEND_URL` — Your backend API URL
- `API_SECRET_KEY` — Optional, forwarded to the backend via `X-API-Key`
- `PROCESS_ROW_TIMEOUT_MS` — Optional, default 300000 (5 min)

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Development Guidelines

### Adding New Components
1. Create component in `components/` directory
2. Use TypeScript with proper interfaces
3. Follow existing naming conventions
4. Import types from `@/types`

### State Management
- Page-level state in `app/page.tsx`
- Component-specific state in individual components
- Use `useCallback` for handler functions
- Use `useMemo` for expensive computations

### Styling
- Use Tailwind CSS utility classes
- Follow responsive design patterns (mobile-first)
- Maintain consistent spacing and colors
- Use Lucide React for icons

## License

MIT
