import crypto from 'crypto';
import { Injectable, ForbiddenException, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { createCompanySchema, roleSchema, createInviteSchema, acceptInviteSchema, installModuleSchema } from '@monocore/shared';
import { AuditService } from '../common/audit.service.js';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class AppApiService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async createCompany(userId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = createCompanySchema.parse(payload);

    const company = await this.prisma.company.create({
      data: {
        name: body.name,
        plan: 'free'
      }
    });

    const membership = await this.prisma.companyMembership.create({
      data: {
        companyId: company.id,
        userId,
        status: 'active'
      }
    });

    const ownerRole = await this.prisma.companyRole.create({
      data: {
        companyId: company.id,
        key: 'owner',
        name: 'Owner'
      }
    });

    const permissions = await this.prisma.companyPermission.findMany();
    for (const permission of permissions) {
      await this.prisma.companyRolePermission.create({
        data: {
          roleId: ownerRole.id,
          permissionId: permission.id
        }
      });
    }

    await this.prisma.companyMemberRole.create({
      data: {
        membershipId: membership.id,
        roleId: ownerRole.id
      }
    });

    await this.audit.logCompany({
      actorUserId: userId,
      companyId: company.id,
      action: 'company.create',
      entityType: 'company',
      entityId: company.id,
      metadata: { name: company.name },
      ip,
      userAgent
    });

    return company;
  }

  async myCompanies(userId: string) {
    return this.prisma.companyMembership.findMany({
      where: { userId, status: 'active' },
      include: { company: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async dashboard(companyId: string) {
    const [teamCount, roleCount, modules] = await Promise.all([
      this.prisma.companyMembership.count({ where: { companyId } }),
      this.prisma.companyRole.count({ where: { companyId } }),
      this.prisma.moduleInstallation.findMany({ where: { companyId, status: 'ACTIVE' } })
    ]);

    return {
      companyId,
      teamCount,
      roleCount,
      installedModules: modules.map((m) => m.moduleKey)
    };
  }

  listTeam(companyId: string) {
    return this.prisma.companyMembership.findMany({
      where: { companyId },
      include: { user: true, roles: { include: { role: true } } }
    });
  }

  listInvites(companyId: string) {
    return this.prisma.companyInvite.findMany({
      where: { companyId },
      include: { role: true, createdByUser: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async createInvite(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = createInviteSchema.parse(payload);
    if (body.roleId) {
      const role = await this.prisma.companyRole.findUnique({ where: { id: body.roleId } });
      if (!role || role.companyId !== companyId) {
        throw new ForbiddenException('Role is not owned by tenant');
      }
    }

    const rawToken = crypto.randomBytes(40).toString('hex');
    const invite = await this.prisma.companyInvite.create({
      data: {
        companyId,
        email: body.email,
        tokenHash: this.hashToken(rawToken),
        roleId: body.roleId ?? null,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdByUserId: actorUserId
      }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.invite.create',
      entityType: 'company_invite',
      entityId: invite.id,
      metadata: { email: invite.email, roleId: invite.roleId },
      ip,
      userAgent
    });

    return {
      ...invite,
      token: rawToken,
      acceptUrl: `/auth/accept-invite?scope=company&token=${rawToken}`
    };
  }

  async resendInvite(companyId: string, id: string, actorUserId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.companyInvite.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) throw new NotFoundException('Invite not found');
    if (existing.usedAt || existing.revokedAt) throw new BadRequestException('Invite cannot be resent');

    const rawToken = crypto.randomBytes(40).toString('hex');
    const invite = await this.prisma.companyInvite.update({
      where: { id },
      data: {
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.invite.resend',
      entityType: 'company_invite',
      entityId: invite.id,
      metadata: { email: invite.email },
      ip,
      userAgent
    });

    return {
      ...invite,
      token: rawToken,
      acceptUrl: `/auth/accept-invite?scope=company&token=${rawToken}`
    };
  }

  async revokeInvite(companyId: string, id: string, actorUserId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.companyInvite.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) throw new NotFoundException('Invite not found');

    const invite = await this.prisma.companyInvite.update({
      where: { id },
      data: { revokedAt: new Date() }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.invite.revoke',
      entityType: 'company_invite',
      entityId: invite.id,
      metadata: { email: invite.email },
      ip,
      userAgent
    });

    return invite;
  }

  async acceptInvite(actorUserId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = acceptInviteSchema.parse(payload);
    const tokenHash = this.hashToken(body.token);
    const invite = await this.prisma.companyInvite.findUnique({ where: { tokenHash } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.usedAt || invite.revokedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite is no longer valid');
    }

    const user = await this.prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('Invite email does not match authenticated user');
    }

    const membership = await this.prisma.companyMembership.upsert({
      where: { companyId_userId: { companyId: invite.companyId, userId: actorUserId } },
      create: {
        companyId: invite.companyId,
        userId: actorUserId,
        status: 'active',
        invitedById: invite.createdByUserId
      },
      update: { status: 'active' }
    });

    if (invite.roleId) {
      const role = await this.prisma.companyRole.findUnique({ where: { id: invite.roleId } });
      if (role && role.companyId === invite.companyId) {
        await this.prisma.companyMemberRole.upsert({
          where: { membershipId_roleId: { membershipId: membership.id, roleId: invite.roleId } },
          create: { membershipId: membership.id, roleId: invite.roleId },
          update: {}
        });
      }
    }

    await this.prisma.companyInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId: invite.companyId,
      action: 'company.invite.accept',
      entityType: 'company_invite',
      entityId: invite.id,
      metadata: { email: invite.email, roleId: invite.roleId },
      ip,
      userAgent
    });

    return membership;
  }

  listRoles(companyId: string) {
    return this.prisma.companyRole.findMany({
      where: { companyId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createRole(actorUserId: string, companyId: string, payload: unknown) {
    const body = roleSchema.parse(payload);
    const role = await this.prisma.companyRole.create({
      data: {
        companyId,
        key: body.key,
        name: body.name,
        description: body.description
      }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.role.create',
      entityType: 'company_role',
      entityId: role.id,
      metadata: body
    });

    return role;
  }

  listPermissions() {
    return this.prisma.companyPermission.findMany({ orderBy: { key: 'asc' } });
  }

  async assignPermission(actorUserId: string, companyId: string, roleId: string, permissionId: string) {
    const role = await this.prisma.companyRole.findUnique({ where: { id: roleId } });
    if (!role || role.companyId !== companyId) {
      throw new ForbiddenException('Role is not owned by tenant');
    }

    await this.prisma.companyRolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId },
      update: {}
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.role_permission.assign',
      entityType: 'company_role',
      entityId: roleId,
      metadata: { permissionId }
    });

    return { success: true };
  }

  async assignMemberRole(actorUserId: string, companyId: string, membershipId: string, roleId: string) {
    const membership = await this.prisma.companyMembership.findUnique({ where: { id: membershipId } });
    const role = await this.prisma.companyRole.findUnique({ where: { id: roleId } });

    if (!membership || !role || membership.companyId !== companyId || role.companyId !== companyId) {
      throw new ForbiddenException('Cross-tenant assignment blocked');
    }

    await this.prisma.companyMemberRole.upsert({
      where: { membershipId_roleId: { membershipId, roleId } },
      create: { membershipId, roleId },
      update: {}
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.member_role.assign',
      entityType: 'company_membership',
      entityId: membershipId,
      metadata: { roleId }
    });

    return { success: true };
  }

  listAuditLogs(companyId: string) {
    return this.prisma.companyAuditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  listInstalledModules(companyId: string) {
    return this.prisma.moduleInstallation.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { module: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async listModuleCatalog(companyId: string) {
    const [catalog, installations, entitlements] = await Promise.all([
      this.prisma.module.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.moduleInstallation.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { moduleKey: true }
      }),
      this.prisma.companyEntitlement.findMany({
        where: { companyId },
        select: { moduleKey: true, limits: true }
      })
    ]);

    const installedKeys = new Set(installations.map((row) => row.moduleKey));
    const entitlementByKey = new Map(entitlements.map((row) => [row.moduleKey, row.limits]));

    return catalog.map((module) => ({
      ...module,
      installed: installedKeys.has(module.key),
      entitlementLimits: entitlementByKey.get(module.key) ?? null
    }));
  }

  async installModule(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = installModuleSchema.parse(payload);
    const module = await this.prisma.module.findUnique({ where: { key: body.moduleKey } });
    if (!module || module.status !== 'PUBLISHED') {
      throw new NotFoundException('Published module not found');
    }

    const dependencyKeys = this.extractDependencyKeys(module.dependencies);
    if (dependencyKeys.length > 0) {
      const installedDependencies = await this.prisma.moduleInstallation.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          moduleKey: { in: dependencyKeys }
        },
        select: { moduleKey: true }
      });
      const installedSet = new Set(installedDependencies.map((row) => row.moduleKey));
      const missingDependencies = dependencyKeys.filter((key) => !installedSet.has(key));
      if (missingDependencies.length > 0) {
        await this.audit.logCompany({
          actorUserId,
          companyId,
          action: 'company.module.install.blocked_dependencies',
          entityType: 'module',
          entityId: module.id,
          metadata: { moduleKey: module.key, missingDependencies },
          ip,
          userAgent
        });
        throw new BadRequestException(`Missing module dependencies: ${missingDependencies.join(', ')}`);
      }
    }

    const [installation, entitlement] = await this.prisma.$transaction([
      this.prisma.moduleInstallation.upsert({
        where: {
          companyId_moduleKey: {
            companyId,
            moduleKey: body.moduleKey
          }
        },
        create: {
          companyId,
          moduleKey: body.moduleKey,
          status: 'ACTIVE',
          config: body.config,
          installedAt: new Date()
        },
        update: {
          status: 'ACTIVE',
          config: body.config,
          installedAt: new Date()
        }
      }),
      this.prisma.companyEntitlement.upsert({
        where: {
          companyId_moduleKey: {
            companyId,
            moduleKey: body.moduleKey
          }
        },
        create: {
          companyId,
          moduleKey: body.moduleKey,
          limits: {}
        },
        update: {}
      })
    ]);

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.module.install',
      entityType: 'module_installation',
      entityId: installation.id,
      metadata: { moduleKey: body.moduleKey, dependencies: dependencyKeys },
      ip,
      userAgent
    });

    return { installation, entitlement };
  }

  private hashToken(rawToken: string) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private extractDependencyKeys(raw: Prisma.JsonValue): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is string => typeof item === 'string');
    }
    if (raw && typeof raw === 'object') {
      const row = raw as Record<string, unknown>;
      if (Array.isArray(row.modules)) {
        return row.modules.filter((item): item is string => typeof item === 'string');
      }
      return Object.keys(row);
    }
    return [];
  }
}
