import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    example: 'AdminHub Enterprise',
    description: 'Workspace or organization name',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  workspaceName?: string;

  @ApiPropertyOptional({
    example: 'support@adminhub.io',
    description: 'Public support email address',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  supportEmail?: string;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Default system currency code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({
    example: 'PST (UTC-08:00)',
    description: 'Default system timezone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
