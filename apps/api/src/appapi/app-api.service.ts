import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { createCompanySchema, inviteUserSchema, roleSchema } from '@monocore/shared';
import { AuditService } from '../common/audit.service.js';

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

  async inviteMember(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
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

    const membership = await this.prisma.companyMembership.upsert({
      where: { companyId_userId: { companyId, userId: user.id } },
      create: { companyId, userId: user.id, invitedById: actorUserId, status: 'active' },
      update: { status: 'active' }
    });

    for (const roleId of body.roleIds) {
      await this.prisma.companyMemberRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId } },
        create: { membershipId: membership.id, roleId },
        update: {}
      });
    }

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.member.invite',
      entityType: 'company_membership',
      entityId: membership.id,
      metadata: { email: body.email, roleIds: body.roleIds },
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
      orderBy: { createdAt: 'asc' }
    });
  }
}
