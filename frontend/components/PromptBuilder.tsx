'use client';

import { useRef, useEffect } from 'react';
import { MessageSquare, Globe, Cpu, Search, Eye } from 'lucide-react';
import { ScrapeBackend } from '@/types';

interface PromptBuilderProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  scrapeBackend: ScrapeBackend;
  onScrapeBackendChange: (value: ScrapeBackend) => void;
  enableSearch: boolean;
  onEnableSearchChange: (value: boolean) => void;
  browserVisible: boolean;
  onBrowserVisibleChange: (value: boolean) => void;
  availableBackends: ScrapeBackend[];
  browserVisibleSupported: boolean;
  disabled?: boolean;
}

const BACKEND_OPTIONS: Array<{ value: ScrapeBackend; label: string; Icon: typeof Globe }> = [
  { value: 'local', label: 'Local', Icon: Cpu },
  { value: 'firecrawl', label: 'Firecrawl', Icon: Globe },
];

export default function PromptBuilder({
  prompt,
  onPromptChange,
  scrapeBackend,
  onScrapeBackendChange,
  enableSearch,
  onEnableSearchChange,
  browserVisible,
  onBrowserVisibleChange,
  availableBackends,
  browserVisibleSupported,
  disabled,
}: PromptBuilderProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [prompt]);

  const insertColumnTag = (column: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;
    const textBefore = prompt.substring(0, cursorPosition);
    const textAfter = prompt.substring(cursorPosition);
    const tagToInsert = `{${column}}`;
    const newPrompt = textBefore + tagToInsert + textAfter;
    onPromptChange(newPrompt);
    setTimeout(() => {
      textarea.focus();
      const newCursorPosition = cursorPosition + tagToInsert.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  useEffect(() => {
    const handleInsertTag = (event: CustomEvent) => {
      insertColumnTag(event.detail);
    };
    window.addEventListener('insertColumnTag', handleInsertTag as EventListener);
    return () => {
      window.removeEventListener('insertColumnTag', handleInsertTag as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  const browserCheckboxEnabled = scrapeBackend === 'local' && browserVisibleSupported && !disabled;
  const browserTooltip = !browserVisibleSupported
    ? 'Visible browser is not available in this deployment (no display wired). Use the WSLg compose overlay or run the backend on host.'
    : scrapeBackend !== 'local'
    ? 'Visible browser only applies to the Local scrape backend.'
    : '';

  return (
    <div className="card-base">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-50">
          <MessageSquare size={18} className="text-indigo-600" />
        </div>
        <h3 className="font-semibold text-slate-800">Prompt Builder</h3>
      </div>

      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter your prompt here. Click column tags above to insert them as variables (e.g., {column_name})"
        className="textarea-base min-h-36 font-mono text-sm leading-relaxed"
      />

      <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
        <p className="text-sm text-slate-500">
          Click column tags to insert variables
        </p>

        {/* Scrape backend segmented control */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700 mr-1">Scrape backend:</span>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {BACKEND_OPTIONS.map(({ value, label, Icon }) => {
              const isAvailable = availableBackends.includes(value);
              const isSelected = scrapeBackend === value;
              const buttonDisabled = disabled || !isAvailable;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onScrapeBackendChange(value)}
                  disabled={buttonDisabled}
                  title={!isAvailable ? `${label} backend is not available in this deployment` : ''}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors
                    ${isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                    }
                    ${buttonDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                    border-r border-slate-200 last:border-r-0
                  `}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Web search toggle */}
        <div className="flex items-center gap-2">
          <label className={`relative inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              checked={enableSearch}
              onChange={(e) => onEnableSearchChange(e.target.checked)}
              disabled={disabled}
              className="sr-only peer"
            />
            <div className={`
              w-9 h-5 rounded-full transition-all duration-200
              bg-slate-300 peer-checked:bg-indigo-600
              peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:bg-white after:rounded-full after:h-4 after:w-4
              after:shadow after:transition-transform after:duration-200
              peer-checked:after:translate-x-full
            `}></div>
          </label>
          <Search size={14} className={enableSearch ? 'text-indigo-600' : 'text-slate-400'} />
          <span className={`text-sm ${enableSearch ? 'text-slate-700' : 'text-slate-500'}`}>
            Web search
            <span className="text-xs italic text-slate-400">
              {' '}({scrapeBackend === 'firecrawl' ? 'firecrawl_search' : 'search_google'})
            </span>
          </span>
        </div>

        {/* Browser visible checkbox */}
        <div className="flex items-center gap-2" title={browserTooltip}>
          <label className={`relative inline-flex items-center cursor-pointer ${!browserCheckboxEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              checked={browserVisible && browserCheckboxEnabled}
              onChange={(e) => onBrowserVisibleChange(e.target.checked)}
              disabled={!browserCheckboxEnabled}
              className="sr-only peer"
            />
            <div className={`
              w-9 h-5 rounded-full transition-all duration-200
              bg-slate-300 peer-checked:bg-indigo-600
              peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:bg-white after:rounded-full after:h-4 after:w-4
              after:shadow after:transition-transform after:duration-200
              peer-checked:after:translate-x-full
            `}></div>
          </label>
          <Eye size={14} className={browserCheckboxEnabled ? 'text-slate-500' : 'text-slate-300'} />
          <span className={`text-sm ${browserCheckboxEnabled ? 'text-slate-700' : 'text-slate-400'}`}>
            Show browser window
            {!browserVisibleSupported && <span className="text-xs italic"> (Docker — no display)</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
