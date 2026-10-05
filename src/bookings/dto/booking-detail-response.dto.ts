import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentStatus } from '@prisma/client';

export class BookingCustomerSummaryDto {
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

  @ApiProperty({
    example: 12,
    description: 'Total historical bookings completed by this customer',
  })
  completedBookingsCount!: number;
}

export class BookingLifecycleLogDto {
  @ApiProperty({ example: 'l1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'Confirmation Sent' })
  event!: string;

  @ApiProperty({ example: 'Outlook invite dispatched to customer' })
  description!: string;

  @ApiPropertyOptional({ example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  adminId!: string | null;

  @ApiPropertyOptional({ example: 'System Admin' })
  adminName!: string | null;

  @ApiProperty({ example: '2026-10-01T10:00:00.000Z' })
  createdAt!: string;
}

export class BookingDetailResponseDto {
  @ApiProperty({ example: 'b5f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'BKG-0045' })
  bookingCode!: string;

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

  @ApiPropertyOptional({
    example:
      'Need assistance with expanding our payment gateway options and preparing our database backup plans.',
  })
  customerNotes!: string | null;

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

  @ApiProperty({ type: BookingCustomerSummaryDto })
  customer!: BookingCustomerSummaryDto;

  @ApiProperty({ type: [BookingLifecycleLogDto] })
  lifecycleLogs!: BookingLifecycleLogDto[];
}
