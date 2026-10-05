import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminProfileDto,
  LoginResponseDataDto,
} from './dto/auth-response.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDataDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { email: loginDto.email },
    });

    if (!admin) {
      this.logger.warn(
        `Failed authentication attempt for email: ${loginDto.email}`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(loginDto.password, admin.passwordHash);
    if (!isMatch) {
      this.logger.warn(
        `Failed authentication attempt for email: ${loginDto.email}`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Admin authenticated successfully: ${admin.email}`);

    const adminProfile: AdminProfileDto = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      phone: admin.phone,
      timezone: admin.timezone,
      twoFactorEnabled: admin.twoFactorEnabled,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };

    return {
      accessToken,
      admin: adminProfile,
    };
  }

  async getProfile(adminId: string): Promise<AdminProfileDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      phone: admin.phone,
      timezone: admin.timezone,
      twoFactorEnabled: admin.twoFactorEnabled,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  }
}
