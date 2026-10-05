import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  PaginatedUsersResponseDto,
  UserSingleResponseDto,
} from './dto/user-response.dto.js';
import { UserDetailResponseDto } from './dto/user-detail-response.dto.js';
import { UserStatsResponseDto } from './dto/user-stats-response.dto.js';
import { UsersQueryDto } from './dto/users-query.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users',
    description:
      'Returns a paginated list of non-deleted users with search, filtering by role and status, and whitelisted sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated user directory',
    type: PaginatedUsersResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query() query: UsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    return this.usersService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get user summary statistics',
    description:
      'Calculates total, active, inactive, suspended users and MoM growth metrics from PostgreSQL.',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics overview',
    type: UserStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(): Promise<UserStatsResponseDto> {
    const data = await this.usersService.getStats();
    return { data };
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Get user detail by code or UUID',
    description:
      'Retrieves single user profile with bounded related collections (latest 5 transactions, bookings, and activity logs).',
  })
  @ApiParam({
    name: 'code',
    example: 'USR-0001',
    description: 'Unique user code (e.g. USR-0001) or UUID primary key',
  })
  @ApiResponse({
    status: 200,
    description: 'Compound user profile details',
    type: UserDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found or deleted' })
  async findOne(@Param('code') code: string): Promise<UserDetailResponseDto> {
    const data = await this.usersService.findOne(code);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create user',
    description:
      'Creates a new user record with concurrency-safe atomic sequence userCode generation and audit activity log.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserSingleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email address already exists' })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser('id') adminId: string,
  ): Promise<UserSingleResponseDto> {
    const data = await this.usersService.create(createUserDto, adminId);
    return { data };
  }

  @Patch(':code')
  @ApiOperation({
    summary: 'Update user',
    description:
      'Partially updates profile fields or status for an existing user. Enforces email uniqueness.',
  })
  @ApiParam({
    name: 'code',
    example: 'USR-0001',
    description: 'Unique user code or UUID',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserSingleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email address already in use' })
  async update(
    @Param('code') code: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('id') adminId: string,
  ): Promise<UserSingleResponseDto> {
    const data = await this.usersService.update(code, updateUserDto, adminId);
    return { data };
  }

  @Delete(':code')
  @ApiOperation({
    summary: 'Soft delete user',
    description:
      'Sets deletedAt timestamp to mark user inactive without destroying relational data.',
  })
  @ApiParam({
    name: 'code',
    example: 'USR-0001',
    description: 'Unique user code or UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'User soft deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'User not found or already deleted',
  })
  async remove(
    @Param('code') code: string,
    @CurrentUser('id') adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.usersService.remove(code, adminId);
  }
}
