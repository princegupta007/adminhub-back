import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John', description: 'User first name' })
  @IsNotEmpty({ message: 'firstName is required' })
  @IsString({ message: 'firstName must be a string' })
  @MaxLength(100, { message: 'firstName cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  @IsNotEmpty({ message: 'lastName is required' })
  @IsString({ message: 'lastName must be a string' })
  @MaxLength(100, { message: 'lastName cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName!: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'User email' })
  @IsNotEmpty({ message: 'email is required' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255, { message: 'email cannot exceed 255 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({
    example: '+1 (555) 019-8833',
    description: 'User phone number',
  })
  @IsNotEmpty({ message: 'phone is required' })
  @IsString({ message: 'phone must be a string' })
  @MaxLength(50, { message: 'phone cannot exceed 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone!: string;

  @ApiPropertyOptional({
    example: '1995-08-22',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsISO8601(
    { strict: false },
    {
      message: 'dateOfBirth must be a valid ISO-8601 date string (YYYY-MM-DD)',
    },
  )
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: '123 Market St',
    description: 'Street address line',
  })
  @IsOptional()
  @IsString({ message: 'addressLine must be a string' })
  @MaxLength(255, { message: 'addressLine cannot exceed 255 characters' })
  addressLine?: string;

  @ApiPropertyOptional({ example: 'San Francisco', description: 'City' })
  @IsOptional()
  @IsString({ message: 'city must be a string' })
  @MaxLength(100, { message: 'city cannot exceed 100 characters' })
  city?: string;

  @ApiPropertyOptional({ example: 'CA', description: 'State / Province' })
  @IsOptional()
  @IsString({ message: 'state must be a string' })
  @MaxLength(100, { message: 'state cannot exceed 100 characters' })
  state?: string;

  @ApiPropertyOptional({ example: 'USA', description: 'Country' })
  @IsOptional()
  @IsString({ message: 'country must be a string' })
  @MaxLength(100, { message: 'country cannot exceed 100 characters' })
  country?: string;

  @ApiPropertyOptional({
    example: 'https://i.pravatar.cc/150?u=johndoe',
    description: 'Avatar image URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  @MaxLength(500, { message: 'avatarUrl cannot exceed 500 characters' })
  avatarUrl?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    default: UserRole.VIEWER,
    description: 'User access role',
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'role must be one of: ADMIN, EDITOR, VIEWER' })
  role?: UserRole;

  @ApiPropertyOptional({
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    description: 'User lifecycle status',
  })
  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'status must be one of: ACTIVE, INACTIVE, SUSPENDED',
  })
  status?: UserStatus;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Two factor authentication enabled',
  })
  @IsOptional()
  @IsBoolean({ message: 'twoFactorEnabled must be a boolean' })
  twoFactorEnabled?: boolean;
}
