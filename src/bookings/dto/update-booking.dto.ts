import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateBookingDto {
  @ApiPropertyOptional({
    description: 'Rescheduled start date and time in ISO 8601 format',
    example: '2026-10-20T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Updated service duration in decimal hours',
    example: 2.0,
    minimum: 0.5,
    maximum: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(24)
  durationHours?: number;

  @ApiPropertyOptional({
    description: 'Updated service name',
    example: 'Deep Carpet & Floor Cleaning',
  })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional({
    description: 'Updated service category',
    example: 'Cleaning',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Updated meeting/service location',
    example: 'Virtual - Zoom Link Provided',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Updated customer notes or instructions',
    example: 'Customer requested reschedule to Tuesday afternoon',
  })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiPropertyOptional({
    description: 'Updated booking status',
    enum: BookingStatus,
    example: BookingStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Updated payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Updated payment method',
    example: 'Credit Card (Visa ending in 4582)',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Updated fee amount',
    example: 189.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description:
      'Administrative reason note for change (recorded in lifecycle log)',
    example: 'Rescheduled per customer email request',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
