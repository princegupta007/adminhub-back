import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';

export class BookingSummaryDto {
  @ApiProperty({ example: 'b5f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'BKG-0045' })
  bookingCode!: string;

  @ApiProperty({ example: 'd4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  userId!: string;

  @ApiProperty({ example: 'Sarah Jenkins' })
  customerName!: string;

  @ApiPropertyOptional({ example: 'sarah.jenkins@example.com' })
  customerEmail!: string | null;

  @ApiPropertyOptional({ example: 'https://i.pravatar.cc/150?u=1' })
  customerAvatar!: string | null;

  @ApiProperty({ example: 'Home Deep Cleaning' })
  serviceName!: string;

  @ApiProperty({ example: 'Cleaning' })
  category!: string;

  @ApiProperty({ example: '2026-10-12T10:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty({ example: 1.5 })
  durationHours!: number;

  @ApiProperty({ example: '2026-10-12T11:30:00.000Z' })
  endTime!: string;

  @ApiProperty({ example: 'Virtual - Zoom Link Provided' })
  location!: string;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CONFIRMED })
  status!: BookingStatus;

  @ApiProperty({ example: 149.0 })
  amount!: number;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PAID })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ example: 'Credit Card (Visa ending in 4582)' })
  paymentMethod!: string;

  @ApiProperty({ example: 'INV-98943' })
  invoiceCode!: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  updatedAt!: string;
}

export class PaginatedBookingsResponseDto {
  @ApiProperty({ type: [BookingSummaryDto] })
  data!: BookingSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
