import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottleLogin } from '../common/decorators/throttle-login.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface.js';
import { AuthService } from './auth.service.js';
import {
  AdminProfileResponseDto,
  LoginResponseDto,
} from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';

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
      'Authenticates admin credentials using bcrypt and issues a signed JWT access token. Stricter rate limiting applied (5 requests per minute).',
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
}
