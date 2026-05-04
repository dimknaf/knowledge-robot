/**
 * Utility functions for the application
 */

/**
 * Formats a number with commas for better readability
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Truncates a string to a specified length
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

/**
 * Validates if a string is a valid column name for template interpolation
 */
export function isValidColumnReference(str: string, columns: string[]): boolean {
  const regex = /\{([^}]+)\}/g;
  const matches = str.match(regex);

  if (!matches) return true; // No references, so valid

  for (const match of matches) {
    const columnName = match.slice(1, -1);
    if (!columns.includes(columnName)) {
      return false;
    }
  }

  return true;
}

/**
 * Extracts column references from a template string
 */
export function extractColumnReferences(template: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const matches = template.match(regex);

  if (!matches) return [];

  return matches.map((match) => match.slice(1, -1));
}

/**
 * Formats a date to a readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
