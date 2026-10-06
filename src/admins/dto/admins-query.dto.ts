import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

export class AdminsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: AdminRole,
    description: 'Filter by administrator role',
  })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional({
    description: 'Search by administrator name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
