import { CsvRow, OutputField, ScrapeBackend, AgentCapabilities, DEFAULT_SCRAPE_BACKEND } from '@/types';

const PROCESS_ROW_TIMEOUT_MS = 300_000; // 5 min — generous upper bound per row.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const processRow = async (
  rowData: CsvRow,
  prompt: string,
  outputFields: OutputField[],
  scrapeBackend: ScrapeBackend = DEFAULT_SCRAPE_BACKEND,
  enableSearch: boolean = false,
  browserVisible: boolean = false
): Promise<Record<string, string | number | boolean>> => {
  const interpolatedPrompt = interpolatePrompt(prompt, rowData);

  console.log('🔄 Sending request to API:', {
    url: `${BASE_PATH}/api/process-row`,
    row: Object.keys(rowData),
    fields: outputFields.map(f => f.name),
    scrapeBackend,
    enableSearch,
    browserVisible,
  });

  let response: Response;
  try {
    response = await fetch(`${BASE_PATH}/api/process-row`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        row_data: rowData,
        prompt: interpolatedPrompt,
        output_schema: outputFields.map(f => ({
          name: f.name,
          type: f.type,
          description: f.description
        })),
        scrape_backend: scrapeBackend,
        enable_search: enableSearch,
        browser_visible: browserVisible,
      }),
      signal: AbortSignal.timeout(PROCESS_ROW_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(`Row timed out after ${PROCESS_ROW_TIMEOUT_MS / 1000}s — backend may still be working; try lower concurrency.`);
    }
    throw err;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Backend error: ${response.status}`);
  }

  const result = await response.json();
  console.log('✅ Backend response received:', {
    fields: Object.keys(result.output),
    processingTime: result.metadata?.processing_time_ms
  });

  const output = { ...result.output };
  delete output._processed_at;
  return output;
};

/**
 * Fetch agent capabilities (which scrape backends are available + whether
 * the visible browser checkbox should be enabled).
 */
export const getAgentCapabilities = async (): Promise<AgentCapabilities> => {
  const response = await fetch(`${BASE_PATH}/api/agent-status`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Agent-status fetch failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    availableScrapeBackends: (data.available_scrape_backends || ['local']) as ScrapeBackend[],
    browserVisibleSupported: Boolean(data.browser_visible_supported),
    model: data.model,
    llmProfile: data.llm_profile,
  };
};

export function interpolatePrompt(prompt: string, rowData: CsvRow): string {
  let interpolated = prompt;
  const regex = /\{([^}]+)\}/g;
  const matches = prompt.match(regex);
  if (matches) {
    matches.forEach((match) => {
      const columnName = match.slice(1, -1);
      const value = rowData[columnName];
      interpolated = interpolated.replace(
        match,
        value !== undefined && value !== null ? String(value) : ''
      );
    });
  }
  return interpolated;
}
