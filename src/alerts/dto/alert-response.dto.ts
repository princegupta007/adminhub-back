import { ApiProperty } from '@nestjs/swagger';
import { AlertSeverity } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';

export class AlertResponseDto {
  @ApiProperty({
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    description: 'Alert UUID',
  })
  id: string;

  @ApiProperty({
    example: 'Server capacity at 92%',
    description: 'Alert title headline',
  })
  title: string;

  @ApiProperty({
    example: 'Scale compute resources immediately',
    description: 'Actionable alert description',
  })
  description: string;

  @ApiProperty({
    example: 'CRITICAL',
    enum: AlertSeverity,
    description: 'Alert severity level',
  })
  severity: AlertSeverity;

  @ApiProperty({
    example: 'danger',
    enum: ['danger', 'warning', 'info'],
    description: 'Frontend visual tone badge',
  })
  tone: 'danger' | 'warning' | 'info';

  @ApiProperty({
    example: false,
    description: 'Resolution status',
  })
  isResolved: boolean;

  @ApiProperty({
    example: '2 hours ago',
    description: 'Relative time string formatted for UI',
  })
  time: string;

  @ApiProperty({
    example: '2026-10-05T18:00:00.000Z',
    description: 'Creation ISO 8601 timestamp',
  })
  createdAt: string;
}

export class PaginatedAlertsResponseDto {
  @ApiProperty({
    type: [AlertResponseDto],
    description: 'Array of alert records',
  })
  data: AlertResponseDto[];

  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Pagination metadata',
  })
  meta: PaginationMetaDto;
}

export class ResolveAlertResponseDto {
  @ApiProperty({
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    description: 'Alert UUID',
  })
  id: string;

  @ApiProperty({
    example: true,
    description: 'Updated resolution status',
  })
  isResolved: boolean;

  @ApiProperty({
    example: 'Alert marked as resolved',
    description: 'Confirmation message',
  })
  message: string;
}

export class BatchResolveResponseDto {
  @ApiProperty({
    example: 2,
    description: 'Count of alerts updated to resolved',
  })
  resolvedCount: number;

  @ApiProperty({
    example: [
      'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
      'b2f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    ],
    description: 'Array of resolved alert IDs',
    type: [String],
  })
  ids: string[];

  @ApiProperty({
    example: 'Successfully resolved 2 alerts',
    description: 'Confirmation message',
  })
  message: string;
}

export class ResolveAllResponseDto {
  @ApiProperty({
    example: 3,
    description: 'Total number of active alerts resolved',
  })
  resolvedCount: number;

  @ApiProperty({
    example: 'All active alerts marked as resolved',
    description: 'Confirmation message',
  })
  message: string;
}

export class DeleteAlertResponseDto {
  @ApiProperty({
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    description: 'Deleted alert UUID',
  })
  id: string;

  @ApiProperty({
    example: 'Alert deleted successfully',
    description: 'Confirmation message',
  })
  message: string;
}
