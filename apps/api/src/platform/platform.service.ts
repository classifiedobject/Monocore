import crypto from 'crypto';
import { Injectable, NotFoundException, Inject, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { roleSchema, permissionSchema, moduleSchema, languagePackSchema, createInviteSchema, acceptInviteSchema } from '@monocore/shared';
import { AuditService } from '../common/audit.service.js';
import { SessionService } from '../auth/session.service.js';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class PlatformService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SessionService) private readonly sessions: SessionService
  ) {}

  dashboard() {
    return {
      message: 'Platform dashboard',
      metrics: {
        companies: this.prisma.company.count(),
        users: this.prisma.user.count(),
        modules: this.prisma.module.count()
      }
    };
  }

  listPlatformUsers() {
    return this.prisma.platformMembership.findMany({
      include: { user: true, roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  listPlatformInvites() {
    return this.prisma.platformInvite.findMany({
      include: { role: true, createdByUser: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async createPlatformInvite(actorUserId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = createInviteSchema.parse(payload);
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const invite = await this.prisma.platformInvite.create({
      data: {
        email: body.email,
        tokenHash,
        roleId: body.roleId ?? null,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdByUserId: actorUserId
      }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.invite.create',
      entityType: 'platform_invite',
      entityId: invite.id,
      metadata: { email: invite.email, roleId: invite.roleId },
      ip,
      userAgent
    });

    return {
      ...invite,
      token: rawToken,
      acceptUrl: `/auth/accept-invite?scope=platform&token=${rawToken}`
    };
  }

  async resendPlatformInvite(id: string, actorUserId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.platformInvite.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invite not found');
    if (existing.usedAt || existing.revokedAt) throw new BadRequestException('Invite cannot be resent');

    const rawToken = crypto.randomBytes(40).toString('hex');
    const invite = await this.prisma.platformInvite.update({
      where: { id },
      data: {
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.invite.resend',
      entityType: 'platform_invite',
      entityId: invite.id,
      metadata: { email: invite.email },
      ip,
      userAgent
    });

    return {
      ...invite,
      token: rawToken,
      acceptUrl: `/auth/accept-invite?scope=platform&token=${rawToken}`
    };
  }

  async revokePlatformInvite(id: string, actorUserId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.platformInvite.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invite not found');

    const invite = await this.prisma.platformInvite.update({
      where: { id },
      data: { revokedAt: new Date() }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.invite.revoke',
      entityType: 'platform_invite',
      entityId: invite.id,
      metadata: { email: invite.email },
      ip,
      userAgent
    });

    return invite;
  }

  async acceptPlatformInvite(actorUserId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = acceptInviteSchema.parse(payload);
    const tokenHash = this.hashToken(body.token);
    const invite = await this.prisma.platformInvite.findUnique({ where: { tokenHash } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.usedAt || invite.revokedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite is no longer valid');
    }

    const user = await this.prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('Invite email does not match authenticated user');
    }

    const membership = await this.prisma.platformMembership.upsert({
      where: { userId: actorUserId },
      create: { userId: actorUserId, invitedById: invite.createdByUserId, isActive: true },
      update: { isActive: true }
    });

    if (invite.roleId) {
      await this.prisma.platformUserRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId: invite.roleId } },
        create: { membershipId: membership.id, roleId: invite.roleId },
        update: {}
      });
    }

    await this.prisma.platformInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.invite.accept',
      entityType: 'platform_invite',
      entityId: invite.id,
      metadata: { email: invite.email, roleId: invite.roleId },
      ip,
      userAgent
    });

    return membership;
  }

  async assignPlatformRole(actorUserId: string, membershipId: string, roleId: string, ip?: string, userAgent?: string) {
    await this.prisma.platformUserRole.upsert({
      where: { membershipId_roleId: { membershipId, roleId } },
      create: { membershipId, roleId },
      update: {}
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.team.role.assign',
      entityType: 'platform_membership',
      entityId: membershipId,
      metadata: { roleId },
      ip,
      userAgent
    });

    return { success: true };
  }

  async invalidateUserSessions(actorUserId: string, targetUserId: string, ip?: string, userAgent?: string) {
    await this.sessions.invalidateAllForUser(targetUserId);
    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.sessions.invalidate',
      entityType: 'user',
      entityId: targetUserId,
      metadata: {},
      ip,
      userAgent
    });
    return { success: true };
  }

  listPlatformRoles() {
    return this.prisma.platformRole.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPlatformRole(actorUserId: string, payload: unknown) {
    const body = roleSchema.parse(payload);
    const role = await this.prisma.platformRole.create({
      data: { key: body.key, name: body.name, description: body.description }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.role.create',
      entityType: 'platform_role',
      entityId: role.id,
      metadata: body
    });

    return role;
  }

  async createPlatformPermission(actorUserId: string, payload: unknown) {
    const body = permissionSchema.parse(payload);
    const permission = await this.prisma.platformPermission.create({ data: body });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.permission.create',
      entityType: 'platform_permission',
      entityId: permission.id,
      metadata: body
    });

    return permission;
  }

  listPlatformPermissions() {
    return this.prisma.platformPermission.findMany({ orderBy: { key: 'asc' } });
  }

  async attachPermissionToRole(actorUserId: string, roleId: string, permissionId: string) {
    await this.prisma.platformRolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId },
      update: {}
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.role_permission.assign',
      entityType: 'platform_role',
      entityId: roleId,
      metadata: { permissionId }
    });

    return { success: true };
  }

  listCompanies() {
    return this.prisma.company.findMany({
      include: { modules: true, memberships: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateCompanyPlan(actorUserId: string, companyId: string, plan: string) {
    const company = await this.prisma.company.update({ where: { id: companyId }, data: { plan } });
    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.company.plan_update',
      entityType: 'company',
      entityId: company.id,
      metadata: { plan }
    });
    return company;
  }

  listModules() {
    return this.prisma.module.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async upsertModule(actorUserId: string, payload: unknown) {
    const body = moduleSchema.parse(payload);
    const module = await this.prisma.module.upsert({
      where: { key: body.key },
      create: {
        key: body.key,
        name: body.name,
        description: body.description,
        version: body.version,
        status: body.status,
        dependencies: body.dependencies,
        pricingMeta: body.pricingMeta
      },
      update: {
        name: body.name,
        description: body.description,
        version: body.version,
        status: body.status,
        dependencies: body.dependencies,
        pricingMeta: body.pricingMeta
      }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.module.upsert',
      entityType: 'module',
      entityId: module.id,
      metadata: body
    });

    return module;
  }

  listSettings() {
    return this.prisma.siteSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async setSetting(actorUserId: string, key: string, value: string) {
    const setting = await this.prisma.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.setting.update',
      entityType: 'site_setting',
      entityId: setting.id,
      metadata: { key, value }
    });

    return setting;
  }

  listLanguagePacks(locale?: string) {
    return this.prisma.languagePack.findMany({
      where: locale ? { locale } : {},
      orderBy: [{ locale: 'asc' }, { namespace: 'asc' }, { key: 'asc' }]
    });
  }

  async upsertLanguagePack(actorUserId: string, payload: unknown) {
    const body = languagePackSchema.parse(payload);
    const row = await this.prisma.languagePack.upsert({
      where: {
        locale_namespace_key: {
          locale: body.locale,
          namespace: body.namespace,
          key: body.key
        }
      },
      create: body,
      update: { value: body.value }
    });

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.i18n.update',
      entityType: 'language_pack',
      entityId: row.id,
      metadata: body
    });

    return row;
  }

  async companyDetails(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: { include: { user: true } },
        modules: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private hashToken(rawToken: string) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
