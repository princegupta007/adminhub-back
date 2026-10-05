import { describe, expect, it } from 'vitest';
import { calculateSkip, createPaginationMeta } from './pagination.util.js';

describe('Pagination Utilities', () => {
  describe('calculateSkip', () => {
    it('should calculate skip correctly for page 1', () => {
      expect(calculateSkip(1, 10)).toBe(0);
    });

    it('should calculate skip correctly for page 3 with limit 15', () => {
      expect(calculateSkip(3, 15)).toBe(30);
    });

    it('should handle zero or negative page values safely', () => {
      expect(calculateSkip(0, 10)).toBe(0);
      expect(calculateSkip(-5, 10)).toBe(0);
    });
  });

  describe('createPaginationMeta', () => {
    it('should calculate pagination metadata accurately', () => {
      const meta = createPaginationMeta(45, 2, 10);
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(10);
      expect(meta.total).toBe(45);
      expect(meta.totalPages).toBe(5);
    });

    it('should handle 0 total items gracefully', () => {
      const meta = createPaginationMeta(0, 1, 10);
      expect(meta.total).toBe(0);
      expect(meta.totalPages).toBe(0);
    });
  });
});
