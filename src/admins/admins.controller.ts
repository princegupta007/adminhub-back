import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface.js';
import { AdminsService } from './admins.service.js';
import {
  AdminListResponseDto,
  AdminMessageResponseDto,
  AdminResponseDto,
} from './dto/admin-response.dto.js';
import { AdminsQueryDto } from './dto/admins-query.dto.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto.js';

@ApiTags('Admin Directory')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  @ApiOperation({
    summary: 'List administrator accounts',
    description:
      'Retrieves a paginated directory of administrators with optional role filtering and keyword search. Restricted to SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Administrator list retrieved successfully',
    type: AdminListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires SUPER_ADMIN)' })
  async findAll(@Query() query: AdminsQueryDto): Promise<AdminListResponseDto> {
    return this.adminsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get administrator by ID',
    description:
      'Retrieves administrator account details by UUID. Restricted to SUPER_ADMIN.',
  })
  @ApiParam({ name: 'id', description: 'Administrator UUID' })
  @ApiResponse({
    status: 200,
    description: 'Administrator retrieved successfully',
    type: AdminResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Administrator not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminResponseDto> {
    const data = await this.adminsService.findOne(id);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new administrator account',
    description:
      'Provisions a new administrator account with bcrypt hashed password. Restricted to SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 201,
    description: 'Administrator created successfully',
    type: AdminResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Email conflict' })
  async create(@Body() dto: CreateAdminDto): Promise<AdminResponseDto> {
    const data = await this.adminsService.create(dto);
    return { data };
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'Update administrator role',
    description:
      'Changes administrator role (ADMIN or SUPER_ADMIN). Enforces invariants preventing self-demotion and demotion of the last Super Admin.',
  })
  @ApiParam({ name: 'id', description: 'Administrator UUID' })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully',
    type: AdminResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid operation (e.g. self-demotion or sole super admin)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Administrator not found' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateAdminRoleDto,
  ): Promise<AdminResponseDto> {
    const data = await this.adminsService.updateRole(id, currentUser.id, dto);
    return { data };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete administrator account',
    description:
      'Removes an administrator account. Enforces invariants preventing self-deletion and deletion of the last Super Admin.',
  })
  @ApiParam({ name: 'id', description: 'Administrator UUID' })
  @ApiResponse({
    status: 200,
    description: 'Administrator account deleted successfully',
    type: AdminMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid operation (e.g. self-deletion or sole super admin)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Administrator not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AdminMessageResponseDto> {
    return this.adminsService.delete(id, currentUser.id);
  }
}
