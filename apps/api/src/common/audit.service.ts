import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

type AuditInput = {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  companyId?: string;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async logPlatform(data: AuditInput) {
    await this.prisma.platformAuditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata ?? {},
        ip: data.ip,
        userAgent: data.userAgent
      }
    });
  }

  async logCompany(data: AuditInput) {
    if (!data.companyId) return;
    await this.prisma.companyAuditLog.create({
      data: {
        actorUserId: data.actorUserId,
        companyId: data.companyId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata ?? {},
        ip: data.ip,
        userAgent: data.userAgent
      }
    });
  }
}
