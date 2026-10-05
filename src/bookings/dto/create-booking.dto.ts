import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Target customer User UUID',
    example: 'd4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'Name of the service booked',
    example: 'Home Deep Cleaning',
  })
  @IsString()
  @IsNotEmpty()
  serviceName!: string;

  @ApiProperty({
    description: 'Service classification category',
    example: 'Cleaning',
  })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({
    description: 'Scheduled start date and time in ISO 8601 format',
    example: '2026-10-18T14:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: 'Service duration in decimal hours (e.g. 1.5 for 90 minutes)',
    example: 1.5,
    default: 1.5,
    minimum: 0.5,
    maximum: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(24)
  durationHours?: number = 1.5;

  @ApiProperty({
    description: 'Total fee for the service appointment',
    example: 149.0,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    description: 'Payment method string identifier',
    example: 'Credit Card (Visa ending in 4582)',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @ApiPropertyOptional({
    description: 'Initial payment settlement status',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus = PaymentStatus.PENDING;

  @ApiPropertyOptional({
    description: 'Meeting or service delivery location',
    default: 'Virtual - Zoom Link Provided',
    example: 'Virtual - Zoom Link Provided',
  })
  @IsOptional()
  @IsString()
  location?: string = 'Virtual - Zoom Link Provided';

  @ApiPropertyOptional({
    description: 'Special requests or notes from customer',
    example: 'Need focus on the kitchen appliances and window tracks',
  })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiPropertyOptional({
    description: 'Initial booking status',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus = BookingStatus.CONFIRMED;
}
