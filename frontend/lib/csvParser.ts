import Papa from 'papaparse';
import { CsvData, CsvRow } from '@/types';

export const parseCSV = (file: File): Promise<CsvData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
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
