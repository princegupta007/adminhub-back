import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiProperty({
    example: true,
    description: 'Two-factor authentication toggle',
  })
  @IsNotEmpty()
  @IsBoolean()
  twoFactorEnabled!: boolean;
}
