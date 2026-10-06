import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
} from 'class-validator';

export class BulkUserStatusDto {
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
    description: 'Target user status',
    enum: UserStatus,
    example: UserStatus.SUSPENDED,
  })
  @IsEnum(UserStatus)
  status!: UserStatus;
}
