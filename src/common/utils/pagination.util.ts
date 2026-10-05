import { PaginationMetaDto } from '../dto/pagination.dto.js';

export function calculateSkip(page: number, limit: number): number {
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.max(1, limit || 10);
  return (safePage - 1) * safeLimit;
}

export function createPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMetaDto {
  const safeTotal = Math.max(0, total || 0);
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.max(1, limit || 10);
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);

  return new PaginationMetaDto(safePage, safeLimit, safeTotal, totalPages);
}
