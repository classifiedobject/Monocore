import crypto from 'crypto';
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

const INACTIVITY_DAYS = Number(process.env.SESSION_INACTIVITY_DAYS ?? 30);
const ABSOLUTE_DAYS = Number(process.env.SESSION_ABSOLUTE_DAYS ?? 90);

@Injectable()
export class SessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, ip?: string, userAgent?: string, rotate = true) {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hash(rawToken);
    const now = Date.now();

    if (rotate) {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ip,
        userAgent,
        expiresAt: new Date(now + INACTIVITY_DAYS * 24 * 60 * 60 * 1000),
        absoluteExpiresAt: new Date(now + ABSOLUTE_DAYS * 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(now)
      }
    });

    return rawToken;
  }

  async revoke(rawToken: string) {
    const tokenHash = this.hash(rawToken);
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async resolveUser(rawToken: string) {
    const tokenHash = this.hash(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < now ||
      session.absoluteExpiresAt < now
    ) {
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + INACTIVITY_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    return session.user;
  }

  async invalidateAllForUser(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  private hash(rawToken: string) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
