import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';

export class BulkUserDeleteDto {
  @ApiProperty({
    description:
      'Array of userCodes or UUIDs to soft-delete (max 100 per request)',
    example: ['USR-0001', 'USR-0002'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  userCodes!: string[];
}
