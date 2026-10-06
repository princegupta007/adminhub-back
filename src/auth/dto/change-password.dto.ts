import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentSecret123', description: 'Current password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({
    example: 'NewSecret123!',
    description: 'New password (min 8 characters)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: 'Password updated successfully' })
  message!: string;
}
