import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

export const USER_SORT_FIELDS = [
  'name',
  'email',
  'joinDate',
  'joinedAt',
  'lastActive',
  'lastLoginAt',
  'status',
  'role',
  'createdAt',
  'userCode',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class UsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Search string across name, email, and userCode (precedence over search)',
    example: 'Sarah',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional({
    description: 'Search string alias across name, email, and userCode',
    example: 'Sarah',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter users by role',
    example: UserRole.ADMIN,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      return normalized === 'ALL' || normalized === '' ? undefined : normalized;
    }
    return value;
  })
  @IsEnum(UserRole, {
    message: 'role must be one of: ADMIN, EDITOR, VIEWER',
  })
  role?: UserRole;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter users by status',
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      return normalized === 'ALL' || normalized === '' ? undefined : normalized;
    }
    return value;
  })
  @IsEnum(UserStatus, {
    message: 'status must be one of: ACTIVE, INACTIVE, SUSPENDED',
  })
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Field to sort users by',
    enum: USER_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(USER_SORT_FIELDS as unknown as string[], {
    message: `sortBy must be one of: ${USER_SORT_FIELDS.join(', ')}`,
  })
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction: asc or desc',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'], {
    message: 'order must be either asc or desc',
  })
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Alias for order sort direction',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'], {
    message: 'sortDirection must be either asc or desc',
  })
  sortDirection?: 'asc' | 'desc';
}
