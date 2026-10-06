import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Michael Chen', description: 'Admin full name' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'michael.chen@miles.io',
    description: 'Admin corporate email',
  })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'AdminPass123!',
    description: 'Initial account password (min 8 characters)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    enum: AdminRole,
    default: AdminRole.ADMIN,
    description: 'Assigned administrator role',
  })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole = AdminRole.ADMIN;

  @ApiPropertyOptional({
    example: '+1 (555) 014-8832',
    description: 'Contact phone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    example: 'EST (UTC-05:00)',
    description: 'Primary timezone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
