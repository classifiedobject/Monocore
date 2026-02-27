import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service.js';

type AuditInput = {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
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
        metadata: data.metadata ?? Prisma.JsonNull,
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
        metadata: data.metadata ?? Prisma.JsonNull,
        ip: data.ip,
        userAgent: data.userAgent
      }
    });
  }
}
