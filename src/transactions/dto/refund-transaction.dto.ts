import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefundTransactionDto {
  @ApiPropertyOptional({
    description: 'Reason for issuing the refund',
    example: 'Customer requested cancellation due to scheduling conflict',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
