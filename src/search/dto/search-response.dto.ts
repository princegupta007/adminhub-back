import { ApiProperty } from '@nestjs/swagger';

export class SearchUserResultDto {
  @ApiProperty({ example: 'b3f5818f-afb9-4ffb-a626-e1ce3548f7d7' })
  id!: string;

  @ApiProperty({ example: 'USR-0001' })
  userCode!: string;

  @ApiProperty({ example: 'Sarah Jenkins' })
  name!: string;

  @ApiProperty({ example: 'sarah@example.com' })
  email!: string;

  @ApiProperty({ example: 'ADMIN' })
  role!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

export class SearchTransactionResultDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  id!: string;

  @ApiProperty({ example: 'TXN-0017' })
  txnCode!: string;

  @ApiProperty({ example: 'Sarah Jenkins' })
  customerName!: string;

  @ApiProperty({ example: 1250.0 })
  amount!: number;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ example: 'PAYMENT' })
  type!: string;
}

export class SearchBookingResultDto {
  @ApiProperty({ example: 'd4c3b2a1-f6e5-8b7a-0d9c-6d5c4b3a2e1f' })
  id!: string;

  @ApiProperty({ example: 'BKG-0045' })
  bookingCode!: string;

  @ApiProperty({ example: 'Sarah Jenkins' })
  customerName!: string;

  @ApiProperty({ example: 'Home Deep Cleaning' })
  serviceName!: string;

  @ApiProperty({ example: '2026-10-15T10:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;
}

export class GlobalSearchResponseDto {
  @ApiProperty({ example: 'Sarah' })
  query!: string;

  @ApiProperty({ example: 6 })
  totalMatches!: number;

  @ApiProperty({ type: [SearchUserResultDto] })
  users!: SearchUserResultDto[];

  @ApiProperty({ type: [SearchTransactionResultDto] })
  transactions!: SearchTransactionResultDto[];

  @ApiProperty({ type: [SearchBookingResultDto] })
  bookings!: SearchBookingResultDto[];
}
