'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Bot } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ColumnTags from '@/components/ColumnTags';
import DataPreview from '@/components/DataPreview';
import PromptBuilder from '@/components/PromptBuilder';
import OutputSchemaBuilder from '@/components/OutputSchemaBuilder';
import ProfileManager from '@/components/ProfileManager';
import ExecutionControls from '@/components/ExecutionControls';
import ResultsTable from '@/components/ResultsTable';
import ExportButton from '@/components/ExportButton';
import { CsvData, OutputField, ProcessedRow, Profile, ScrapeBackend, DEFAULT_SCRAPE_BACKEND } from '@/types';
import { processRow, getAgentCapabilities } from '@/lib/mockBackend';

export default function Home() {
  // State
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [prompt, setPrompt] = useState('');
  const [outputFields, setOutputFields] = useState<OutputField[]>([]);
  const [concurrentRuns, setConcurrentRuns] = useState(5);
  const [includeInput, setIncludeInput] = useState(true);
  const [scrapeBackend, setScrapeBackend] = useState<ScrapeBackend>(DEFAULT_SCRAPE_BACKEND);
  const [enableSearch, setEnableSearch] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [availableBackends, setAvailableBackends] = useState<ScrapeBackend[]>(['local', 'firecrawl']);
  const [browserVisibleSupported, setBrowserVisibleSupported] = useState(false);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [llmProfile, setLlmProfile] = useState<string | undefined>(undefined);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedRow[]>([]);
  const [progress, setProgress] = useState(0);

  // Capability discovery on mount.
  useEffect(() => {
    getAgentCapabilities()
      .then((caps) => {
        setAvailableBackends(caps.availableScrapeBackends);
        setBrowserVisibleSupported(caps.browserVisibleSupported);
        setModel(caps.model);
        setLlmProfile(caps.llmProfile);
        setBackendOnline(true);
        // If current default isn't actually available, fall back to first available.
        if (!caps.availableScrapeBackends.includes(scrapeBackend) && caps.availableScrapeBackends.length > 0) {
          setScrapeBackend(caps.availableScrapeBackends[0]);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch agent capabilities:', err);
        setBackendOnline(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abort controller for stopping processing
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle CSV upload
  const handleFileUpload = useCallback((data: CsvData) => {
    setCsvData(data);
    setResults([]);
    setProgress(0);
  }, []);

  // Handle column tag click
  const handleTagClick = useCallback((column: string) => {
    // Dispatch custom event to insert tag into prompt
    window.dispatchEvent(
      new CustomEvent('insertColumnTag', { detail: column })
    );
  }, []);

  // Start processing
  const handleStart = useCallback(async () => {
    if (!csvData || csvData.rows.length === 0) {
      alert('Please upload a CSV file first');
      return;
    }

    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    if (outputFields.length === 0) {
      alert('Please define at least one output field');
      return;
    }

    console.log('🚀 Starting processing with', concurrentRuns, 'concurrent runs');
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    // Initialize results with all rows as pending
    const initialResults: ProcessedRow[] = csvData.rows.map((row, index) => ({
      rowIndex: index,
      status: 'pending',
      inputData: row,
    }));
    setResults(initialResults);
    setProgress(0);

    // Process rows with proper concurrency control using worker pool
    let completedCount = 0;
    const totalRows = csvData.rows.length;
    let currentRowIndex = 0;

    const processNextRow = async (rowIndex: number): Promise<void> => {
      if (abortControllerRef.current?.signal.aborted) {
        console.log('⏹️ Processing aborted for row', rowIndex);
        return;
      }

      const row = csvData.rows[rowIndex];
      console.log('⚙️ Processing row', rowIndex + 1, 'of', totalRows);

      // Update status to processing
      setResults((prev) =>
        prev.map((r) =>
          r.rowIndex === rowIndex ? { ...r, status: 'processing' } : r
        )
      );

      try {
        const outputData = await processRow(row, prompt, outputFields, scrapeBackend, enableSearch, browserVisible);

        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        console.log('✅ Completed row', rowIndex + 1);

        // Update with completed result
        setResults((prev) =>
          prev.map((r) =>
            r.rowIndex === rowIndex
              ? { ...r, status: 'completed', outputData }
              : r
          )
        );

        completedCount++;
        setProgress((completedCount / totalRows) * 100);
      } catch (error) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        console.error('❌ Error processing row', rowIndex + 1, error);

        // Update with error
        setResults((prev) =>
          prev.map((r) =>
            r.rowIndex === rowIndex
              ? {
                  ...r,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                }
              : r
          )
        );

        completedCount++;
        setProgress((completedCount / totalRows) * 100);
      }
    };

    // Worker pool pattern: maintain N concurrent workers
    const workers: Promise<void>[] = [];

    const startWorker = async (): Promise<void> => {
      while (currentRowIndex < totalRows && !abortControllerRef.current?.signal.aborted) {
        const rowIndex = currentRowIndex++;
        await processNextRow(rowIndex);
      }
    };

    // Start workers up to concurrency limit
    const workerCount = Math.min(concurrentRuns, totalRows);
    console.log('👷 Starting', workerCount, 'workers');

    for (let i = 0; i < workerCount; i++) {
      workers.push(startWorker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    console.log('🎉 All processing complete!');
    setIsProcessing(false);
  }, [csvData, prompt, outputFields, concurrentRuns, scrapeBackend, enableSearch, browserVisible]);

  // Stop processing
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
  }, []);

  // Handle profile load
  const handleProfileLoad = useCallback((profile: Profile) => {
    setPrompt(profile.prompt);
    setOutputFields(profile.outputFields);
    setScrapeBackend(profile.scrapeBackend);
    setEnableSearch(profile.enableSearch);
    setBrowserVisible(profile.browserVisible);
    setCurrentProfileName(profile.name);
  }, []);

  // Handle profile clear
  const handleProfileClear = useCallback(() => {
    setCurrentProfileName(null);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Header — full viewport bleed */}
      <header className="hero-backdrop border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              {/* Brand mark — Bot icon tile */}
              <div
                className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--primary-foreground)] shadow-[var(--shadow-card)] flex-shrink-0"
                style={{ background: 'var(--gradient-primary)' }}
                aria-hidden="true"
              >
                <Bot size={24} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold tracking-tight text-[var(--foreground)] leading-none mb-1.5">
                  Knowledge Robot
                </h1>
                <p className="text-sm text-[var(--foreground-muted)] max-w-2xl leading-relaxed">
                  An agentic AI for repetitive knowledge work — web research, browsing,
                  structured extraction. Drop in a CSV, describe the task, define the
                  output, and let the agent run it row-by-row.
                </p>
              </div>
            </div>

            {/* Backend status chip */}
            <BackendStatusChip
              online={backendOnline}
              backends={availableBackends}
              model={model}
              llmProfile={llmProfile}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-10">
        <div className="space-y-8">
          {/* File Upload - Always show when no CSV */}
          {!csvData && (
            <FileUpload onFileUpload={handleFileUpload} disabled={isProcessing} />
          )}

          {/* Column Tags - Show when CSV loaded */}
          {csvData && (
            <ColumnTags
              columns={csvData.headers}
              onTagClick={handleTagClick}
            />
          )}

          {/* Data Preview - Show when CSV loaded */}
          {csvData && (
            <DataPreview headers={csvData.headers} rows={csvData.rows} />
          )}

          {/* Two Column Layout for Prompt and Schema - Always show */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Prompt Builder */}
            <PromptBuilder
              prompt={prompt}
              onPromptChange={setPrompt}
              scrapeBackend={scrapeBackend}
              onScrapeBackendChange={setScrapeBackend}
              enableSearch={enableSearch}
              onEnableSearchChange={setEnableSearch}
              browserVisible={browserVisible}
              onBrowserVisibleChange={setBrowserVisible}
              availableBackends={availableBackends}
              browserVisibleSupported={browserVisibleSupported}
              disabled={isProcessing || !csvData}
            />

            {/* Output Schema Builder */}
            <OutputSchemaBuilder
              fields={outputFields}
              onFieldsChange={setOutputFields}
              disabled={isProcessing || !csvData}
            />
          </div>

          {/* Profile Manager - Always show */}
          <ProfileManager
            prompt={prompt}
            outputFields={outputFields}
            scrapeBackend={scrapeBackend}
            enableSearch={enableSearch}
            browserVisible={browserVisible}
            currentProfileName={currentProfileName}
            onProfileLoad={handleProfileLoad}
            onProfileClear={handleProfileClear}
            disabled={isProcessing || !csvData}
          />

          {/* Execution Controls - Always show */}
          <ExecutionControls
            concurrentRuns={concurrentRuns}
            onConcurrentRunsChange={setConcurrentRuns}
            includeInput={includeInput}
            onIncludeInputChange={setIncludeInput}
            isProcessing={isProcessing}
            onStart={handleStart}
            onStop={handleStop}
            disabled={!csvData || !prompt || outputFields.length === 0}
          />

          {/* Results Table - Show when results exist */}
          {results.length > 0 && (
            <ResultsTable
              results={results}
              outputFields={outputFields}
              includeInput={includeInput}
              isProcessing={isProcessing}
              progress={progress}
            />
          )}

          {/* Export and Reset Buttons - Always show */}
          <div className="flex justify-between items-center pt-4">
            <div>
              {csvData && !isProcessing && (
                <button
                  onClick={() => {
                    setCsvData(null);
                    setPrompt('');
                    setOutputFields([]);
                    setResults([]);
                    setProgress(0);
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload New CSV
                </button>
              )}
            </div>
            <ExportButton
              results={results}
              includeInput={includeInput}
              disabled={isProcessing || results.length === 0}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

interface BackendStatusChipProps {
  online: boolean;
  backends: ScrapeBackend[];
  model?: string;
  llmProfile?: string;
}

function BackendStatusChip({ online, backends, model, llmProfile }: BackendStatusChipProps) {
  // Trim model string for display: "deepinfra/google/gemma-4-31B-it" -> "gemma-4-31B-it"
  const trimmedModel = model
    ? model.split('/').slice(-1)[0]
    : null;

  return (
    <div
      className="inline-flex items-center gap-2.5 h-9 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-xs)] text-xs"
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`status-dot ${online ? 'status-dot-live animate-status-pulse' : 'status-dot-offline'}`}
          aria-hidden="true"
        />
        <span className="font-medium text-[var(--foreground)]">
          {online ? 'Connected' : 'Offline'}
        </span>
      </span>
      {online && backends.length > 0 && (
        <>
          <span className="text-[var(--border-strong)]" aria-hidden="true">·</span>
          <span className="text-[var(--foreground-muted)] capitalize">
            {backends.join(' + ')}
          </span>
        </>
      )}
      {online && (llmProfile || trimmedModel) && (
        <>
          <span className="text-[var(--border-strong)]" aria-hidden="true">·</span>
          <span className="font-mono text-[11px] text-[var(--foreground-muted)] truncate max-w-[14rem]" title={model}>
            {llmProfile && <span className="text-[var(--foreground-subtle)]">{llmProfile}/</span>}
            {trimmedModel}
          </span>
        </>
      )}
    </div>
  );
}
