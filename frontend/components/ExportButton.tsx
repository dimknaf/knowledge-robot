'use client';

import { Download } from 'lucide-react';
import { ProcessedRow, CsvRow } from '@/types';
import { exportToCSV } from '@/lib/csvParser';

interface ExportButtonProps {
  results: ProcessedRow[];
  includeInput: boolean;
  disabled?: boolean;
}

export default function ExportButton({
  results,
  includeInput,
  disabled,
}: ExportButtonProps) {
  const handleExport = () => {
    // Filter only completed rows
    const completedRows = results.filter((row) => row.status === 'completed');

    if (completedRows.length === 0) {
      alert('No completed rows to export');
      return;
    }

    // Prepare data for export
    const exportData: CsvRow[] = completedRows.map((row) => {
      if (includeInput) {
        return {
          ...row.inputData,
          ...row.outputData,
        };
      } else {
        return row.outputData || {};
      }
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `csv-analysis-${timestamp}.csv`;

    exportToCSV(exportData, filename);
  };

  const hasCompletedRows = results.some((row) => row.status === 'completed');

  return (
    <button
      onClick={handleExport}
      disabled={disabled || !hasCompletedRows}
      className="btn-primary flex items-center justify-center gap-2 group"
    >
      <Download size={18} className="group-hover:animate-bounce-subtle" />
      Export to CSV
    </button>
  );
}
