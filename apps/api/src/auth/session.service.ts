import crypto from 'crypto';
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

const SESSION_DAYS = 14;

@Injectable()
export class SessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, ip?: string, userAgent?: string) {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hash(rawToken);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
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

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  }

  private hash(rawToken: string) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
