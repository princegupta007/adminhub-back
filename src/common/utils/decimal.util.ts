import { Prisma } from '@prisma/client';

export function toDecimalNumber(
  val: Prisma.Decimal | number | string | null | undefined,
): number {
  if (val === null || val === undefined) {
    return 0;
  }
  if (val instanceof Prisma.Decimal) {
    return Number(val.toFixed(2));
  }
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return Number.isNaN(num) ? 0 : Number(num.toFixed(2));
}

export function formatCurrency(
  val: Prisma.Decimal | number | string | null | undefined,
  currency: string = 'USD',
): string {
  const amount = toDecimalNumber(val);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
