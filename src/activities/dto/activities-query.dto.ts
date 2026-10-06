import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

export class ActivitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by activity action title',
    example: 'Profile Updated',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'Search keyword across action and description',
    example: 'Password',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Start of date range (ISO 8601 string)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO 8601 string' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End of date range (ISO 8601 string)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO 8601 string' })
  endDate?: string;
}
