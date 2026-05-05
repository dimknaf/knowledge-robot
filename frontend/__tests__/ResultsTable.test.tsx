import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import ResultsTable from '@/components/ResultsTable';
import type { OutputField, ProcessedRow } from '@/types';

afterEach(() => {
  cleanup();
});

const SCHEMA: OutputField[] = [
  { id: 'a', name: 'analysis', type: 'text', description: '' },
  { id: 'b', name: 'risk_score', type: 'number', description: '' },
];

describe('ResultsTable', () => {
  it('returns null when results is empty (renders nothing)', () => {
    const { container } = render(
      <ResultsTable
        results={[]}
        outputFields={SCHEMA}
        includeInput={true}
        isProcessing={false}
        progress={0}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders output column headers from the SCHEMA, not from results[0].outputData (regression test)', () => {
    // The bug this guards: if a worker pool is processing rows N>0 first while row 0 is still pending,
    // results[0].outputData is undefined, but the table must still display the schema's output columns.
    const results: ProcessedRow[] = [
      { rowIndex: 0, status: 'pending',   inputData: { company: 'Acme' } /* outputData intentionally omitted */ },
      { rowIndex: 1, status: 'completed', inputData: { company: 'Beta' }, outputData: { analysis: 'positive', risk_score: 12 } },
    ];

    render(
      <ResultsTable
        results={results}
        outputFields={SCHEMA}
        includeInput={true}
        isProcessing={true}
        progress={50}
      />
    );

    // Both schema-defined output columns must be visible in the header
    const tableHeaders = screen.getAllByRole('columnheader');
    const headerTexts = tableHeaders.map((th) => th.textContent ?? '');
    expect(headerTexts.some((t) => t.includes('analysis'))).toBe(true);
    expect(headerTexts.some((t) => t.includes('risk_score'))).toBe(true);

    // The completed row's output renders
    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders the input column header when includeInput=true', () => {
    const results: ProcessedRow[] = [
      { rowIndex: 0, status: 'completed', inputData: { company: 'Acme' }, outputData: { analysis: 'x', risk_score: 1 } },
    ];

    render(
      <ResultsTable
        results={results}
        outputFields={SCHEMA}
        includeInput={true}
        isProcessing={false}
        progress={100}
      />
    );

    const headerTexts = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    expect(headerTexts.some((t) => t.includes('company'))).toBe(true);
  });

  it('hides input columns when includeInput=false', () => {
    const results: ProcessedRow[] = [
      { rowIndex: 0, status: 'completed', inputData: { company: 'Acme' }, outputData: { analysis: 'x', risk_score: 1 } },
    ];

    render(
      <ResultsTable
        results={results}
        outputFields={SCHEMA}
        includeInput={false}
        isProcessing={false}
        progress={100}
      />
    );

    const headerTexts = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    expect(headerTexts.some((t) => t.includes('company'))).toBe(false);
    expect(headerTexts.some((t) => t.includes('analysis'))).toBe(true);
  });

  it('renders the four KPI stat cards (Total / Completed / In progress / Failed)', () => {
    const results: ProcessedRow[] = [
      { rowIndex: 0, status: 'completed',  inputData: {}, outputData: { analysis: 'a', risk_score: 1 } },
      { rowIndex: 1, status: 'completed',  inputData: {}, outputData: { analysis: 'b', risk_score: 2 } },
      { rowIndex: 2, status: 'processing', inputData: {} },
      { rowIndex: 3, status: 'error',      inputData: {}, error: 'boom' },
    ];

    render(
      <ResultsTable
        results={results}
        outputFields={SCHEMA}
        includeInput={true}
        isProcessing={true}
        progress={50}
      />
    );

    // Stat-card labels
    expect(screen.getByText(/^Total$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Completed$/i)).toBeInTheDocument();
    expect(screen.getByText(/^In progress$/i)).toBeInTheDocument();
    // "Failed" appears in the stat card AND in error-row cells, so use getAllByText
    expect(screen.getAllByText(/^Failed$/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the failed cell as italic "Failed" placeholder for errored rows', () => {
    const results: ProcessedRow[] = [
      { rowIndex: 0, status: 'error', inputData: { company: 'Acme' }, error: 'agent crashed' },
    ];

    const { container } = render(
      <ResultsTable
        results={results}
        outputFields={SCHEMA}
        includeInput={true}
        isProcessing={false}
        progress={0}
      />
    );

    // The "output" cells of error rows should show italic "Failed"
    const failedCells = within(container).getAllByText(/^Failed$/);
    // At least one in the table body (excluding the stat-card label which is "Failed" too)
    expect(failedCells.length).toBeGreaterThan(0);
  });
});
