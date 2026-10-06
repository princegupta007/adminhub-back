import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Admin } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminProfileDto,
  LoginResponseDataDto,
} from './dto/auth-response.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private mapAdminProfile(admin: Admin): AdminProfileDto {
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

    return {
      accessToken,
      admin: this.mapAdminProfile(admin),
    };
  }

  async getProfile(adminId: string): Promise<AdminProfileDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }

    return this.mapAdminProfile(admin);
  }

  async updateProfile(
    adminId: string,
    dto: UpdateProfileDto,
  ): Promise<AdminProfileDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }

    const updated = await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    this.logger.log(`Admin profile updated for adminId: ${adminId}`);
    return this.mapAdminProfile(updated);
  }

  async changePassword(
    adminId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }

    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      admin.passwordHash,
    );
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash },
    });

    this.logger.log(`Password changed successfully for adminId: ${adminId}`);
    return { message: 'Password updated successfully' };
  }

  async updatePreferences(
    adminId: string,
    dto: UpdatePreferencesDto,
  ): Promise<AdminProfileDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }

    const updated = await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        twoFactorEnabled: dto.twoFactorEnabled,
      },
    });

    this.logger.log(`Preferences updated for adminId: ${adminId}`);
    return this.mapAdminProfile(updated);
  }
}
