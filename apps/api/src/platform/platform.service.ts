import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { roleSchema, permissionSchema, moduleSchema, languagePackSchema, inviteUserSchema } from '@monocore/shared';
import { AuditService } from '../common/audit.service.js';

@Injectable()
export class PlatformService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
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

  async invitePlatformUser(actorUserId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inviteUserSchema.parse(payload);

    const user = await this.prisma.user.upsert({
      where: { email: body.email },
      create: {
        email: body.email,
        fullName: body.email.split('@')[0],
        passwordHash: 'pending_invite'
      },
      update: {}
    });

    const membership = await this.prisma.platformMembership.upsert({
      where: { userId: user.id },
      create: { userId: user.id, invitedById: actorUserId },
      update: {}
    });

    for (const roleId of body.roleIds) {
      await this.prisma.platformUserRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId } },
        create: { membershipId: membership.id, roleId },
        update: {}
      });
    }

    await this.audit.logPlatform({
      actorUserId,
      action: 'platform.user.invite',
      entityType: 'platform_membership',
      entityId: membership.id,
      metadata: { email: body.email, roleIds: body.roleIds },
      ip,
      userAgent
    });

    return membership;
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
}
