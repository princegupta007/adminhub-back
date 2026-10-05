import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be greater than or equal to 1' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be greater than or equal to 1' })
  @Max(100, { message: 'limit must be less than or equal to 100' })
  limit: number = 10;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 10, description: 'Items per page limit' })
  limit: number;

  @ApiProperty({
    example: 50,
    description: 'Total number of items matching criteria',
  })
  total: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages: number;

  constructor(page: number, limit: number, total: number, totalPages: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = totalPages;
  }
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMetaDto;

  constructor(data: T[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}
