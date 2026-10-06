import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';

export class ActivityUserDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User UUID',
  })
  id!: string;

  @ApiProperty({ example: 'USR-0001', description: 'Unique user code' })
  userCode!: string;

  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  name!: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'User email' })
  email!: string;
}

export class ActivityDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Activity UUID',
  })
  id!: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Target User UUID',
  })
  userId!: string;

  @ApiProperty({
    example: 'Password Changed',
    description: 'Activity action tag',
  })
  action!: string;

  @ApiProperty({
    example: 'User requested password change via email reset link',
    description: 'Detailed description of the activity event',
  })
  description!: string;

  @ApiProperty({
    example: '2026-10-06T09:00:00.000Z',
    description: 'Event timestamp',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    type: ActivityUserDto,
    description: 'Associated user summary',
  })
  user?: ActivityUserDto;
}

export class ActivityListResponseDto {
  @ApiProperty({ type: [ActivityDto] })
  data!: ActivityDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
