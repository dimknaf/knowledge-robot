// CSV Data Types
export type CsvRow = Record<string, string | number | boolean>;

export interface CsvData {
  headers: string[];
  rows: CsvRow[];
}

// Output Schema Types
export type FieldType = 'text' | 'number' | 'boolean' | 'date';

export interface OutputField {
  id: string;
  name: string;
  type: FieldType;
  description: string;
}

export interface OutputSchema {
  fields: OutputField[];
}

// Scrape backend selection
export type ScrapeBackend = 'firecrawl' | 'local';

export const DEFAULT_SCRAPE_BACKEND: ScrapeBackend = 'local';

// Processing Types
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ProcessedRow {
  rowIndex: number;
  status: ProcessingStatus;
  inputData: CsvRow;
  outputData?: Record<string, string | number | boolean>;
  error?: string;
}

export interface ProcessingConfig {
  concurrentRuns: number;
  includeInput: boolean;
  prompt: string;
  outputSchema: OutputSchema;
}

// Application State
export interface AppState {
  csvData: CsvData | null;
  prompt: string;
  outputSchema: OutputSchema;
  concurrentRuns: number;
  includeInput: boolean;
  isProcessing: boolean;
  results: ProcessedRow[];
  progress: number;
}

// Profile Types (for saving/loading configurations)
export interface Profile {
  name: string;
  prompt: string;
  outputFields: OutputField[];
  scrapeBackend: ScrapeBackend;
  enableSearch: boolean;
  browserVisible: boolean;
  version: string;
  createdAt: string;
}

// Agent capability discovery (returned by /api/agent-status)
export interface AgentCapabilities {
  availableScrapeBackends: ScrapeBackend[];
  browserVisibleSupported: boolean;
  model?: string;
  llmProfile?: string;
}
