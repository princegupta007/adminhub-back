import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateTransactionStatusDto {
  @ApiProperty({
    description: 'Target transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  @IsEnum(TransactionStatus)
  @IsNotEmpty()
  status!: TransactionStatus;

  @ApiProperty({
    description:
      'Audit note explaining reason or processor event for status change',
    example: 'Settlement confirmed by merchant bank',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;
}
