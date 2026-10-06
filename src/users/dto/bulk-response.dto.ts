import { ApiProperty } from '@nestjs/swagger';

export class BulkOperationResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 3 })
  affectedCount!: number;

  @ApiProperty({
    example: ['USR-0001', 'USR-0002', 'USR-0003'],
    type: [String],
  })
  affectedCodes!: string[];

  @ApiProperty({ example: 'Successfully updated 3 users' })
  message!: string;
}
