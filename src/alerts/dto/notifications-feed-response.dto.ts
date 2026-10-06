import { ApiProperty } from '@nestjs/swagger';
import { AlertSeverity } from '@prisma/client';

export class NotificationFeedItemDto {
  @ApiProperty({
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    description: 'Notification identifier',
  })
  id: string;

  @ApiProperty({
    example: 'Server capacity at 92%',
    description: 'Headline notification title',
  })
  title: string;

  @ApiProperty({
    example: 'Scale compute resources',
    description: 'Notification body message',
  })
  body: string;

  @ApiProperty({
    example: 'danger',
    enum: ['brand', 'success', 'warning', 'danger', 'info'],
    description: 'UI visual tone badge',
  })
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'info';

  @ApiProperty({
    example: 'CRITICAL',
    enum: AlertSeverity,
    description: 'Severity classification',
  })
  severity: AlertSeverity;

  @ApiProperty({
    example: '2 hours ago',
    description: 'Relative time string for UI',
  })
  time: string;

  @ApiProperty({
    example: true,
    description: 'Unread state flag (true if unresolved)',
  })
  unread: boolean;

  @ApiProperty({
    example: '2026-10-05T18:00:00.000Z',
    description: 'ISO 8601 creation timestamp',
  })
  createdAt: string;
}

export class NotificationsFeedResponseDto {
  @ApiProperty({
    example: 3,
    description: 'Count of unread notifications',
  })
  unreadCount: number;

  @ApiProperty({
    type: [NotificationFeedItemDto],
    description: 'List of recent notifications for the menu feed',
  })
  notifications: NotificationFeedItemDto[];
}
