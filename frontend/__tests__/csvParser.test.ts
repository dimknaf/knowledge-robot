import { describe, it, expect } from 'vitest';
import { parseCSV } from '@/lib/csvParser';

function fileFromString(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

describe('parseCSV', () => {
  it('parses a basic CSV with headers and rows', async () => {
    const csv = 'company,country\nAcme,UK\nBeta,US\n';
    const result = await parseCSV(fileFromString(csv));

    expect(result.headers).toEqual(['company', 'country']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ company: 'Acme', country: 'UK' });
    expect(result.rows[1]).toEqual({ company: 'Beta', country: 'US' });
  });

  it('dynamic-types numeric columns', async () => {
    const csv = 'name,age\nAlice,30\nBob,42\n';
    const result = await parseCSV(fileFromString(csv));

    expect(result.rows[0]).toEqual({ name: 'Alice', age: 30 });
    expect(result.rows[1]).toEqual({ name: 'Bob', age: 42 });
    expect(typeof result.rows[0].age).toBe('number');
  });

  it('handles embedded commas inside quoted cells', async () => {
    const csv = 'company,address\n"Acme, Inc.","221B, Baker St."\n';
    const result = await parseCSV(fileFromString(csv));

    expect(result.rows[0]).toEqual({
      company: 'Acme, Inc.',
      address: '221B, Baker St.',
    });
  });

  it('skips empty lines', async () => {
    const csv = 'a,b\n1,2\n\n3,4\n\n\n';
    const result = await parseCSV(fileFromString(csv));

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ a: 1, b: 2 });
    expect(result.rows[1]).toEqual({ a: 3, b: 4 });
  });

  it('handles a single-row CSV', async () => {
    const csv = 'a,b,c\n1,2,3\n';
    const result = await parseCSV(fileFromString(csv));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('handles a header-only CSV (no data rows)', async () => {
    const csv = 'a,b,c\n';
    const result = await parseCSV(fileFromString(csv));

    expect(result.headers).toEqual(['a', 'b', 'c']);
    expect(result.rows).toEqual([]);
  });

  it('parses a single-column CSV (no delimiter character anywhere)', async () => {
    // Mirrors test_symbols_failed.csv: header + tickers, CRLF line endings,
    // no commas/tabs/pipes/semicolons. PapaParse can't auto-detect a delimiter
    // and emits an "UndetectableDelimiter" warning; the data still parses fine.
    const csv = 'Symbol\r\nAMZN\r\nCRSR\r\nAMD\r\nMSFT\r\n0700.HK\r\n';
    const result = await parseCSV(fileFromString(csv));

    expect(result.headers).toEqual(['Symbol']);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0]).toEqual({ Symbol: 'AMZN' });
    expect(result.rows[4]).toEqual({ Symbol: '0700.HK' });
  });
});
