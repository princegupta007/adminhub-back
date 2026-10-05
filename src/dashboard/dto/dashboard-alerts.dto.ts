import { ApiProperty } from '@nestjs/swagger';
import { AlertSeverity } from '@prisma/client';

export class AlertItemDto {
  @ApiProperty({
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    description: 'Alert UUID',
  })
  id: string;

  @ApiProperty({
    example: 'Server capacity at 92%',
    description: 'Alert headline title',
  })
  title: string;

  @ApiProperty({
    example: 'Scale compute resources',
    description: 'Actionable description',
  })
  description: string;

  @ApiProperty({
    example: 'CRITICAL',
    enum: AlertSeverity,
    description: 'Backend severity level',
  })
  severity: AlertSeverity;

  @ApiProperty({
    example: 'danger',
    enum: ['danger', 'warning', 'info'],
    description: 'Frontend visual tone badge',
  })
  tone: 'danger' | 'warning' | 'info';

  @ApiProperty({ example: false, description: 'Resolution status' })
  isResolved: boolean;

  @ApiProperty({
    example: '2 hours ago',
    description: 'Relative time string for UI',
  })
  time: string;

  @ApiProperty({
    example: '2026-10-05T18:00:00.000Z',
    description: 'Creation ISO timestamp',
  })
  createdAt: string;
}

export class ResolveAlertResponseDto {
  @ApiProperty({
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    description: 'Alert UUID',
  })
  id: string;

  @ApiProperty({ example: true, description: 'Updated resolution status' })
  isResolved: boolean;

  @ApiProperty({
    example: 'Alert marked as resolved',
    description: 'Status message',
  })
  message: string;
}
