import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret =
      configService.get<string>('jwt.secret') ||
      process.env.JWT_SECRET ||
      'fallback-secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account no longer exists');
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
    };
  }
}
