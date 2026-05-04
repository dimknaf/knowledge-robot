'use client';

import { OutputField, ProcessedRow } from '@/types';
import { CheckCircle, XCircle, Loader2, Clock, Table } from 'lucide-react';

interface ResultsTableProps {
  results: ProcessedRow[];
  outputFields: OutputField[];
  includeInput: boolean;
  isProcessing: boolean;
  progress: number;
}

export default function ResultsTable({
  results,
  outputFields,
  includeInput,
  isProcessing,
  progress,
}: ResultsTableProps) {
  if (results.length === 0) {
    return null;
  }

  // Input columns from row data (always available — populated at upload time).
  // Output columns from the schema, NOT from results[0].outputData — otherwise
  // they don't render until row 0 specifically completes, which with concurrency
  // can lag behind other rows that already have data.
  const inputColumns = results[0]?.inputData
    ? Object.keys(results[0].inputData)
    : [];
  const outputColumns = outputFields.map(f => f.name);

  const allColumns = includeInput
    ? [...inputColumns, ...outputColumns]
    : outputColumns;

  const getStatusBadge = (status: ProcessedRow['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-emerald">
            <CheckCircle size={12} />
            Done
          </span>
        );
      case 'processing':
        return (
          <span className="badge badge-indigo">
            <Loader2 size={12} className="animate-spin" />
            Processing
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-red">
            <XCircle size={12} />
            Error
          </span>
        );
      case 'pending':
        return (
          <span className="badge badge-slate">
            <Clock size={12} />
            Pending
          </span>
        );
    }
  };

  const getRowClass = (status: ProcessedRow['status']) => {
    switch (status) {
      case 'completed':
        return 'status-row-completed';
      case 'processing':
        return 'status-row-processing';
      case 'error':
        return 'status-row-error';
      case 'pending':
        return 'status-row-pending';
    }
  };

  // Calculate stats
  const completedCount = results.filter(r => r.status === 'completed').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const processingCount = results.filter(r => r.status === 'processing').length;

  return (
    <div className="card-base-static">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50">
            <Table size={18} className="text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Processing Results</h3>
            <p className="text-xs text-slate-500">
              {completedCount} completed
              {errorCount > 0 && <span className="text-red-500"> · {errorCount} errors</span>}
              {processingCount > 0 && <span className="text-indigo-500"> · {processingCount} in progress</span>}
            </p>
          </div>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-3">
            <div className="w-40 h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300 animate-progress-stripes"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium text-indigo-600 min-w-[3rem]">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-slate-200 custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Row
              </th>
              {allColumns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  {col}
                  {outputColumns.includes(col) && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                      output
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {results.map((row) => (
              <tr
                key={row.rowIndex}
                className={`${getRowClass(row.status)} transition-colors duration-200`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {getStatusBadge(row.status)}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">
                  {row.rowIndex + 1}
                </td>
                {allColumns.map((col) => {
                  const isOutputColumn = outputColumns.includes(col);
                  const value = isOutputColumn
                    ? row.outputData?.[col]
                    : row.inputData[col];

                  return (
                    <td
                      key={`${row.rowIndex}-${col}`}
                      className={`px-4 py-3 text-sm whitespace-nowrap max-w-xs truncate ${
                        isOutputColumn ? 'font-medium text-indigo-900' : 'text-slate-700'
                      }`}
                      title={value !== null && value !== undefined ? String(value) : ''}
                    >
                      {row.status === 'error' && isOutputColumn ? (
                        <span className="text-red-500 italic text-xs">Failed</span>
                      ) : row.status === 'pending' && isOutputColumn ? (
                        <span className="text-slate-400">—</span>
                      ) : row.status === 'processing' && isOutputColumn ? (
                        <span className="text-indigo-500 italic flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-xs">Processing</span>
                        </span>
                      ) : value !== null && value !== undefined ? (
                        String(value)
                      ) : (
                        ''
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
