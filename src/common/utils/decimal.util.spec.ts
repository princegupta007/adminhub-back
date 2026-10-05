import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { formatCurrency, toDecimalNumber } from './decimal.util.js';

describe('Decimal Utilities', () => {
  describe('toDecimalNumber', () => {
    it('should convert Prisma.Decimal to rounded float number', () => {
      const decimal = new Prisma.Decimal('1234.5678');
      expect(toDecimalNumber(decimal)).toBe(1234.57);
    });

    it('should handle negative values for refunds correctly', () => {
      const negativeDecimal = new Prisma.Decimal('-149.99');
      expect(toDecimalNumber(negativeDecimal)).toBe(-149.99);
    });

    it('should handle null and undefined safely', () => {
      expect(toDecimalNumber(null)).toBe(0);
      expect(toDecimalNumber(undefined)).toBe(0);
    });

    it('should handle number and string inputs', () => {
      expect(toDecimalNumber(89.5)).toBe(89.5);
      expect(toDecimalNumber('42.10')).toBe(42.1);
    });
  });

  describe('formatCurrency', () => {
    it('should format positive amounts as USD currency string', () => {
      const formatted = formatCurrency(new Prisma.Decimal('1250.00'), 'USD');
      expect(formatted).toBe('$1,250.00');
    });

    it('should format negative refund amounts as negative USD currency', () => {
      const formatted = formatCurrency(new Prisma.Decimal('-89.00'), 'USD');
      expect(formatted).toBe('-$89.00');
    });
  });
});
