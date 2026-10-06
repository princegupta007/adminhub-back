import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({
    description:
      'Global search query string across users, transactions, and bookings',
    example: 'Sarah',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({
    description:
      'Maximum items to return per domain category (default 5, max 20)',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}
