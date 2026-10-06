import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BatchResolveAlertDto {
  @ApiProperty({
    example: [
      'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
      'b2f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    ],
    description: 'Array of Alert UUIDs to mark as resolved',
    type: [String],
  })
  @IsArray({ message: 'ids must be an array of UUIDs' })
  @ArrayNotEmpty({ message: 'ids array cannot be empty' })
  @IsUUID('4', { each: true, message: 'Each id must be a valid UUID v4' })
  ids: string[];
}
