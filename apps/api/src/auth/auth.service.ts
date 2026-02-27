import argon2 from 'argon2';
import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { SessionService } from './session.service.js';
import { loginSchema, registerSchema } from '@monocore/shared';
import { AuditService } from '../common/audit.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async register(payload: unknown, ip?: string, userAgent?: string) {
    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const body = parsed.data;
    const existing = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await argon2.hash(body.password);
    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        passwordHash
      }
    });

    const token = await this.sessions.create(user.id, ip, userAgent);
    await this.audit.logPlatform({
      actorUserId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
      ip,
      userAgent
    });

    return { user, token };
  }

  async login(payload: unknown, ip?: string, userAgent?: string) {
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const body = parsed.data;
    const user = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let ok = false;
    try {
      ok = await argon2.verify(user.passwordHash, body.password);
    } catch {
      ok = false;
    }
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.sessions.create(user.id, ip, userAgent);
    await this.audit.logPlatform({
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ip,
      userAgent
    });

    return { user, token };
  }

  async logout(rawToken: string, userId?: string, ip?: string, userAgent?: string) {
    await this.sessions.revoke(rawToken);
    await this.audit.logPlatform({
      actorUserId: userId,
      action: 'auth.logout',
      entityType: 'session',
      ip,
      userAgent
    });
  }
}
