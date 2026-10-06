import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertSeverity } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAlertDto {
  @ApiProperty({
    example: 'Scheduled Maintenance Notice',
    description: 'Alert headline title (3-255 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  @ApiProperty({
    example: 'Database failover scheduled for Sunday at 02:00 UTC.',
    description:
      'Detailed description and suggested remediation (3-500 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Description must be at least 3 characters long' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description: string;

  @ApiPropertyOptional({
    example: 'WARNING',
    enum: AlertSeverity,
    default: AlertSeverity.INFO,
    description: 'Severity level (INFO, WARNING, CRITICAL)',
  })
  @IsOptional()
  @IsEnum(AlertSeverity, {
    message: 'Severity must be one of: INFO, WARNING, CRITICAL',
  })
  severity?: AlertSeverity = AlertSeverity.INFO;
}
