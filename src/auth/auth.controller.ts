import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ThrottleLogin } from '../common/decorators/throttle-login.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface.js';
import { AuthService } from './auth.service.js';
import {
  AdminProfileResponseDto,
  LoginResponseDto,
} from './dto/auth-response.dto.js';
import {
  ChangePasswordDto,
  ChangePasswordResponseDto,
} from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ThrottleLogin()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticates admin credentials using bcrypt and issues a signed JWT access token. Stricter rate limiting applied.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed (e.g. invalid email format or missing fields)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid email or password)',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limit exceeded)',
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    const data = await this.authService.login(loginDto);
    return { data };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Get current authenticated admin',
    description:
      'Retrieves the administrator profile corresponding to the validated JWT bearer token subject claim. Excludes passwordHash.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated admin profile retrieved',
    type: AdminProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (missing, expired, or invalid token)',
  })
  async getMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminProfileResponseDto> {
    const data = await this.authService.getProfile(user.id);
    return { data };
  }

  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({
    summary: 'Update current admin profile',
    description:
      'Updates profile attributes such as display name, phone, timezone, and avatarUrl.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Admin profile updated successfully',
    type: AdminProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<AdminProfileResponseDto> {
    const data = await this.authService.updateProfile(user.id, dto);
    return { data };
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change account password',
    description:
      'Validates current password, hashes new password with bcrypt (10 rounds), and updates the account.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or current password incorrect',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    return this.authService.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @Patch('preferences')
  @ApiOperation({
    summary: 'Update admin account preferences',
    description:
      'Updates security preferences including two-factor authentication toggle.',
  })
  @ApiBody({ type: UpdatePreferencesDto })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: AdminProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<AdminProfileResponseDto> {
    const data = await this.authService.updatePreferences(user.id, dto);
    return { data };
  }
}
