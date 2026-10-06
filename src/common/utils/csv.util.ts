/**
 * RFC 4180 compliant CSV generator with CSV formula injection mitigation.
 */

/**
 * Escapes and sanitizes a single cell value for CSV output.
 * Prevents CSV formula injection (DDE/formula attacks) in spreadsheet viewers like Excel/Calc.
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  let str = String(val);

  // Formula injection prevention: if first character is =, +, -, @, \t, or \r
  // Excel and spreadsheet viewers may execute it as a formula or command.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If contains double quote, comma, newline or carriage return, enclose in quotes and escape quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an array of headers and row matrices into an RFC 4180 compliant CSV string.
 */
export function formatToCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','));

  // UTF-8 BOM prefix (\uFEFF) ensures Excel decodes Unicode characters properly
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n') + '\r\n';
}
