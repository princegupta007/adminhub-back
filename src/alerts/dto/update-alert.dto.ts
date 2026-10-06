import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertSeverity } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAlertDto {
  @ApiPropertyOptional({
    example: 'Updated Alert Title',
    description: 'Updated title (3-255 characters)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title?: string;

  @ApiPropertyOptional({
    example: 'Updated incident description',
    description: 'Updated description (3-500 characters)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Description must be at least 3 characters long' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: 'CRITICAL',
    enum: AlertSeverity,
    description: 'Updated severity level',
  })
  @IsOptional()
  @IsEnum(AlertSeverity, {
    message: 'Severity must be one of: INFO, WARNING, CRITICAL',
  })
  severity?: AlertSeverity;

  @ApiPropertyOptional({
    example: true,
    description: 'Resolution status',
  })
  @IsOptional()
  @IsBoolean()
  isResolved?: boolean;
}
