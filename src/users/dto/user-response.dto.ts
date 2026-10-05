import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';

export class UserSummaryDto {
  @ApiProperty({
    example: 'd4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    description: 'User UUID',
  })
  id!: string;

  @ApiProperty({
    example: 'USR-0001',
    description: 'Unique human-readable user code',
  })
  userCode!: string;

  @ApiProperty({ example: 'Sarah Jenkins', description: 'Combined full name' })
  name!: string;

  @ApiProperty({ example: 'Sarah', description: 'First name' })
  firstName!: string;

  @ApiProperty({ example: 'Jenkins', description: 'Last name' })
  lastName!: string;

  @ApiProperty({
    example: 'sarah.jenkins@example.com',
    description: 'Email address',
  })
  email!: string;

  @ApiProperty({ example: '+1 (555) 014-2210', description: 'Phone number' })
  phone!: string;

  @ApiPropertyOptional({
    example: 'https://i.pravatar.cc/150?u=1',
    description: 'Avatar image URL',
    nullable: true,
  })
  avatarUrl?: string | null;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.ADMIN,
    description: 'User role',
  })
  role!: UserRole;

  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    description: 'User status',
  })
  status!: UserStatus;

  @ApiProperty({
    example: true,
    description: 'Two factor authentication status',
  })
  twoFactorEnabled!: boolean;

  @ApiProperty({
    example: '2024-03-15T00:00:00.000Z',
    description: 'Join date ISO-8601 string',
  })
  joinDate!: string;

  @ApiPropertyOptional({
    example: '2026-10-05T19:30:00.000Z',
    description: 'Last login activity timestamp',
    nullable: true,
  })
  lastActive?: string | null;

  @ApiProperty({
    example: '2024-03-15T00:00:00.000Z',
    description: 'Account record creation timestamp',
  })
  createdAt!: string;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserSummaryDto] })
  data!: UserSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class UserSingleResponseDto {
  @ApiProperty({ type: UserSummaryDto })
  data!: UserSummaryDto;
}
