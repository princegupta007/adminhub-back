import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateAdminRoleDto {
  @ApiProperty({
    enum: AdminRole,
    example: AdminRole.ADMIN,
    description: 'Updated administrative role',
  })
  @IsNotEmpty()
  @IsEnum(AdminRole)
  role!: AdminRole;
}
