import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '@prisma/client';

export class TransactionCustomerSummaryDto {
  @ApiProperty({ example: 'd4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'USR-0001' })
  userCode!: string;

  @ApiProperty({ example: 'Sarah Jenkins' })
  name!: string;

  @ApiProperty({ example: 'Sarah' })
  firstName!: string;

  @ApiProperty({ example: 'Jenkins' })
  lastName!: string;

  @ApiProperty({ example: 'sarah.jenkins@example.com' })
  email!: string;

  @ApiProperty({ example: '+1 555-014-2210' })
  phone!: string;

  @ApiPropertyOptional({ example: 'https://i.pravatar.cc/150?u=1' })
  avatarUrl!: string | null;
}

export class TransactionStatusHistoryEntryDto {
  @ApiProperty({ example: 'h1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  status!: TransactionStatus;

  @ApiProperty({ example: 'Completed & Disbursed to merchant account' })
  note!: string;

  @ApiPropertyOptional({ example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  adminId!: string | null;

  @ApiPropertyOptional({ example: 'System Admin' })
  adminName!: string | null;

  @ApiProperty({ example: '2026-10-04T14:25:00.000Z' })
  createdAt!: string;
}

export class TransactionLedgerItemDto {
  @ApiProperty({ example: 'e4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'TXN-0010' })
  txnCode!: string;

  @ApiProperty({ example: 'Credit Card (Visa ending in 4582)' })
  paymentMethod!: string;

  @ApiProperty({ example: 120.0 })
  amount!: number;

  @ApiProperty({
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  status!: TransactionStatus;

  @ApiPropertyOptional({ example: '2026-08-15T10:14:00.000Z' })
  settledAt!: string | null;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  createdAt!: string;
}

export class TransactionDetailResponseDto {
  @ApiProperty({ example: 'e3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'TXN-0017' })
  txnCode!: string;

  @ApiProperty({ example: 'ref_992743055' })
  reference!: string;

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

  @ApiProperty({ type: TransactionCustomerSummaryDto })
  customer!: TransactionCustomerSummaryDto;

  @ApiProperty({ type: [TransactionStatusHistoryEntryDto] })
  statusHistory!: TransactionStatusHistoryEntryDto[];

  @ApiProperty({ type: [TransactionLedgerItemDto] })
  relatedLedger!: TransactionLedgerItemDto[];
}
