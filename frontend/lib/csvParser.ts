import Papa from 'papaparse';
import { CsvData, CsvRow } from '@/types';

export const parseCSV = (file: File): Promise<CsvData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        // PapaParse emits a non-fatal "UndetectableDelimiter" warning when the
        // sample contains none of `,` `\t` `|` `;` (e.g. a single-column CSV).
        // The data still parses correctly using the default `,` delimiter,
        // so this warning is informational — drop it before deciding to reject.
        const fatalErrors = results.errors.filter(
          (e) => !(e.type === 'Delimiter' && e.code === 'UndetectableDelimiter')
        );
        if (fatalErrors.length > 0) {
          reject(new Error(fatalErrors[0].message));
          return;
        }

        const headers = results.meta.fields || [];
        const rows = results.data as CsvRow[];

        resolve({
          headers,
          rows,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const exportToCSV = (data: CsvRow[], filename: string = 'export.csv'): void => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
