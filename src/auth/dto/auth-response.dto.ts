import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

export class AdminProfileDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Admin UUID',
  })
  id!: string;

  @ApiProperty({ example: 'Sarah Jenkins', description: 'Admin full name' })
  name!: string;

  @ApiProperty({ example: 'admin@miles.io', description: 'Admin email' })
  email!: string;

  @ApiProperty({
    enum: AdminRole,
    example: AdminRole.SUPER_ADMIN,
    description: 'Admin role',
  })
  role!: AdminRole;

  @ApiPropertyOptional({
    example: 'https://i.pravatar.cc/150?u=admin_sarah',
    description: 'Admin avatar URL',
    nullable: true,
  })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    example: '+1 (555) 014-2210',
    description: 'Admin phone number',
    nullable: true,
  })
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'PST (UTC-08:00)',
    description: 'Admin timezone',
    nullable: true,
  })
  timezone?: string | null;

  @ApiProperty({ example: true, description: 'Two-factor auth status' })
  twoFactorEnabled!: boolean;

  @ApiProperty({
    example: '2026-10-05T16:23:03.000Z',
    description: 'Account creation date',
  })
  createdAt!: string;

  @ApiProperty({
    example: '2026-10-05T16:23:03.000Z',
    description: 'Last update timestamp',
  })
  updatedAt!: string;
}

export class LoginResponseDataDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT Bearer Access Token',
  })
  accessToken!: string;

  @ApiProperty({
    type: AdminProfileDto,
    description: 'Authenticated Admin Profile',
  })
  admin!: AdminProfileDto;
}

export class LoginResponseDto {
  @ApiProperty({ type: LoginResponseDataDto })
  data!: LoginResponseDataDto;
}

export class AdminProfileResponseDto {
  @ApiProperty({ type: AdminProfileDto })
  data!: AdminProfileDto;
}
