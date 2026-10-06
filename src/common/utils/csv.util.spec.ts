import { describe, expect, it } from 'vitest';
import { escapeCsvCell, formatToCsv } from './csv.util.js';

describe('csv.util', () => {
  describe('escapeCsvCell', () => {
    it('should return empty string for null or undefined', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('should return normal alphanumeric strings untouched', () => {
      expect(escapeCsvCell('Sarah Jenkins')).toBe('Sarah Jenkins');
      expect(escapeCsvCell('USR-0001')).toBe('USR-0001');
      expect(escapeCsvCell(1250.5)).toBe('1250.5');
    });

    it('should enclose in quotes and escape internal quotes if string has commas or quotes', () => {
      expect(escapeCsvCell('Hello, World')).toBe('"Hello, World"');
      expect(escapeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
      expect(escapeCsvCell('Line1\nLine2')).toBe('"Line1\nLine2"');
    });

    it('should mitigate formula injection by prepending apostrophe', () => {
      expect(escapeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(escapeCsvCell('+12345')).toBe("'+12345");
      expect(escapeCsvCell('-cmd|...')).toBe("'-cmd|...");
      expect(escapeCsvCell('@calc')).toBe("'@calc");
    });
  });

  describe('formatToCsv', () => {
    it('should format headers and rows into compliant CSV with UTF-8 BOM and CRLF', () => {
      const headers = ['ID', 'Name', 'Amount'];
      const rows = [
        ['1', 'Sarah, Jenkins', 100],
        ['2', '=DDE()', 200],
      ];

      const csv = formatToCsv(headers, rows);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('ID,Name,Amount\r\n');
      expect(csv).toContain('1,"Sarah, Jenkins",100\r\n');
      expect(csv).toContain("2,'=DDE(),200\r\n");
    });
  });
});
