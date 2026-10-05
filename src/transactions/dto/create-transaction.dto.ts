import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Target customer User UUID',
    example: 'd4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({
    description: 'Transaction category type',
    enum: TransactionType,
    default: TransactionType.PAYMENT,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType = TransactionType.PAYMENT;

  @ApiPropertyOptional({
    description: 'Initial transaction processing status',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus = TransactionStatus.PENDING;

  @ApiProperty({
    description: 'Total transaction amount in base currency units',
    example: 450.0,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;

  @ApiPropertyOptional({
    description: 'Three-letter currency ISO code',
    default: 'USD',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @ApiProperty({
    description: 'Product or service description',
    example: 'Annual Maintenance Plan',
  })
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @ApiProperty({
    description: 'Payment method string identifier',
    example: 'Credit Card (Visa ending in 4582)',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @ApiPropertyOptional({
    description:
      'Payment processor gateway fee (calculated automatically if omitted)',
    example: 13.05,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gatewayFee?: number;

  @ApiPropertyOptional({
    description:
      'Net amount before gateway fee (calculated automatically if omitted)',
    example: 436.95,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  subtotal?: number;

  @ApiPropertyOptional({
    description: 'Grand total charged (defaults to amount if omitted)',
    example: 450.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  total?: number;

  @ApiPropertyOptional({
    description:
      'External gateway transaction reference (generated if omitted)',
    example: 'ref_992743055',
  })
  @IsOptional()
  @IsString()
  reference?: string;
}
