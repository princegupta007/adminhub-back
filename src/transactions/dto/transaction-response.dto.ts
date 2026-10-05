import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';

export class TransactionSummaryDto {
  @ApiProperty({ example: 'e3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'TXN-0017' })
  txnCode!: string;

  @ApiProperty({ example: 'ref_992743055' })
  reference!: string;

  @ApiProperty({ example: 'd4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  userId!: string;

  @ApiProperty({ example: 'Sarah Jenkins' })
  customerName!: string;

  @ApiPropertyOptional({ example: 'sarah.jenkins@example.com' })
  customerEmail!: string | null;

  @ApiPropertyOptional({ example: 'https://i.pravatar.cc/150?u=1' })
  customerAvatar!: string | null;

  @ApiProperty({ enum: TransactionType, example: TransactionType.PAYMENT })
  type!: TransactionType;

  @ApiProperty({
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  status!: TransactionStatus;

  @ApiProperty({ example: 1250.0 })
  amount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: 'iPhone 13 Pro' })
  productName!: string;

  @ApiProperty({ example: 'Credit Card (Visa ending in 4582)' })
  paymentMethod!: string;

  @ApiProperty({ example: 36.25 })
  gatewayFee!: number;

  @ApiProperty({ example: 1213.75 })
  subtotal!: number;

  @ApiProperty({ example: 1250.0 })
  total!: number;

  @ApiPropertyOptional({ example: '2026-10-04T14:25:00.000Z' })
  settledAt!: string | null;

  @ApiProperty({ example: '2026-10-04T14:20:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-04T14:25:00.000Z' })
  updatedAt!: string;
}

export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [TransactionSummaryDto] })
  data!: TransactionSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
