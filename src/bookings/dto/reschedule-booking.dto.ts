import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({
    description:
      'New scheduled appointment start datetime (must be in the future)',
    example: '2026-11-15T14:00:00.000Z',
  })
  @IsNotEmpty()
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: 'Optional administrative note explaining the reschedule',
    example: 'Client requested postponement to next week',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
