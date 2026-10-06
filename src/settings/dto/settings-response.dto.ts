import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceSettingDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Setting record UUID',
  })
  id!: string;

  @ApiProperty({
    example: 'AdminHub',
    description: 'Workspace or organization name',
  })
  workspaceName!: string;

  @ApiProperty({ example: 'support@adminhub.io', description: 'Support email' })
  supportEmail!: string;

  @ApiProperty({ example: 'USD', description: 'System currency' })
  currency!: string;

  @ApiProperty({ example: 'PST (UTC-08:00)', description: 'System timezone' })
  timezone!: string;

  @ApiProperty({
    example: '2026-10-06T09:00:00.000Z',
    description: 'Last updated timestamp',
  })
  updatedAt!: string;
}

export class WorkspaceSettingResponseDto {
  @ApiProperty({ type: WorkspaceSettingDto })
  data!: WorkspaceSettingDto;
}
