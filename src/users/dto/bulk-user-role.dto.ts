import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';

export class BulkUserRoleDto {
  @ApiProperty({
    description: 'Array of userCodes or UUIDs to update (max 100 per request)',
    example: ['USR-0001', 'USR-0002'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  userCodes!: string[];

  @ApiProperty({
    description: 'Target customer user role',
    enum: UserRole,
    example: UserRole.EDITOR,
  })
  @IsEnum(UserRole)
  role!: UserRole;
}
