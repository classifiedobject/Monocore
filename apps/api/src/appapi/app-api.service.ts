import crypto from 'crypto';
import { Injectable, ForbiddenException, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, SalaryType } from '@prisma/client';
import {
  acceptInviteSchema,
  applyRoleTemplateSchema,
  companyDepartmentSchema,
  companyEmployeeDirectorySchema,
  companyTitleSchema,
  createCompanySchema,
  createInviteSchema,
  demoGenerateSchema,
  installModuleSchema,
  onboardingCompanyBasicsSchema,
  onboardingEmployeeSchema,
  onboardingFirstSalesOrderSchema,
  onboardingInventoryBootstrapSchema,
  onboardingProfitCentersSchema,
  paginationQuerySchema,
  roleSchema
} from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

const INVITE_TTL_DAYS = 7;
const PILOT_MODULE_KEYS = [
  'core',
  'finance-core',
  'inventory-core',
  'recipe-core',
  'sales-core',
  'reservation-core',
  'task-core',
  'executive-core',
  'payroll-core',
  'tip-core'
] as const;

type RoleTemplateKey = 'owner' | 'finance_manager' | 'operations_manager' | 'floor_manager' | 'staff';

type RoleTemplate = {
  key: RoleTemplateKey;
  name: string;
  description: string;
  permissionKeys: string[];
};

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access to all company and module features.',
    permissionKeys: []
  },
  {
    key: 'finance_manager',
    name: 'Finance Manager',
    description: 'Finance, payroll and executive reporting authority.',
    permissionKeys: [
      'company:team.read',
      'company:audit.read',
      'company:modules.read',
      'company:org.read',
      'module:finance-core.entry.create',
      'module:finance-core.entry.read',
      'module:finance-core.entry.delete',
      'module:finance-core.counterparty.manage',
      'module:finance-core.account.manage',
      'module:finance-core.recurring.manage',
      'module:finance-core.reports.read',
      'module:finance-core.profit-center.read',
      'module:finance-core.allocation.read',
      'module:finance-core.invoice.manage',
      'module:finance-core.invoice.read',
      'module:finance-core.payment.manage',
      'module:finance-core.payment.read',
      'module:finance-core.reports.aging.read',
      'module:finance-core.budget.manage',
      'module:finance-core.budget.read',
      'module:finance-core.reports.budget.read',
      'module:finance-core.reports.cashflow.read',
      'module:finance-core.cashflow-forecast.manage',
      'module:payroll-core.employee.manage',
      'module:payroll-core.employee.read',
      'module:payroll-core.employment.manage',
      'module:payroll-core.employment.read',
      'module:payroll-core.compensation.manage',
      'module:payroll-core.compensation.read',
      'module:payroll-core.period.manage',
      'module:payroll-core.period.read',
      'module:payroll-core.period.post',
      'module:payroll-core.payroll.manage',
      'module:payroll-core.payroll.post',
      'module:tip-core.manage',
      'module:executive-core.dashboard.read',
      'module:executive-core.alerts.read'
    ]
  },
  {
    key: 'operations_manager',
    name: 'Operations Manager',
    description: 'Inventory, sales, reservation and task operations manager.',
    permissionKeys: [
      'company:team.read',
      'company:modules.read',
      'company:org.read',
      'company:org.manage',
      'module:inventory-core.item.manage',
      'module:inventory-core.item.cost.manage',
      'module:inventory-core.warehouse.manage',
      'module:inventory-core.movement.manage',
      'module:inventory-core.movement.read',
      'module:recipe-core.product.manage',
      'module:recipe-core.recipe.manage',
      'module:recipe-core.recipe.read',
      'module:sales-core.order.manage',
      'module:sales-core.order.read',
      'module:sales-core.order.post',
      'module:reservation-core.customer.manage',
      'module:reservation-core.reservation.manage',
      'module:reservation-core.reservation.read',
      'module:reservation-core.reports.read',
      'module:task-core.template.manage',
      'module:task-core.task.manage',
      'module:task-core.task.read',
      'module:task-core.task.complete',
      'module:task-core.reports.read'
    ]
  },
  {
    key: 'floor_manager',
    name: 'Floor Manager',
    description: 'Floor-level reservation, service and task execution.',
    permissionKeys: [
      'company:team.read',
      'company:org.read',
      'module:reservation-core.customer.manage',
      'module:reservation-core.reservation.manage',
      'module:reservation-core.reservation.read',
      'module:reservation-core.reports.read',
      'module:task-core.task.manage',
      'module:task-core.task.read',
      'module:task-core.task.complete',
      'module:sales-core.order.read'
    ]
  },
  {
    key: 'staff',
    name: 'Staff',
    description: 'Daily execution access for assigned tasks and reservations.',
    permissionKeys: [
      'module:task-core.task.read',
      'module:task-core.task.complete',
      'module:reservation-core.reservation.read',
      'module:sales-core.order.read',
      'module:inventory-core.movement.read',
      'company:org.read'
    ]
  }
];

type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

@Injectable()
export class AppApiService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async createCompany(userId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = createCompanySchema.parse(payload);

    const company = await this.prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: body.name,
          plan: 'free',
          onboardingCompleted: false,
          onboardingStep: 1
        }
      });

      const membership = await tx.companyMembership.create({
        data: {
          companyId: created.id,
          userId,
          status: 'active'
        }
      });

      await this.ensureRoleTemplates(tx, created.id);
      const ownerRole = await tx.companyRole.findUniqueOrThrow({
        where: { companyId_key: { companyId: created.id, key: 'owner' } }
      });

      await tx.companyMemberRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId: ownerRole.id } },
        create: { membershipId: membership.id, roleId: ownerRole.id },
        update: {}
      });

      await this.ensurePilotModulesInstalled(tx, created.id);
      return created;
    });

    await this.audit.logCompany({
      actorUserId: userId,
      companyId: company.id,
      action: 'company.create',
      entityType: 'company',
      entityId: company.id,
      metadata: { name: company.name, onboardingStep: 1 },
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

  async companyContext(userId: string, companyId: string) {
    const membership = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: {
        company: true,
        roles: { include: { role: true } }
      }
    });

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Company membership required');
    }

    return membership;
  }

  onboardingStatus(companyId: string) {
    return this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        locale: true,
        onboardingCompleted: true,
        onboardingStep: true
      }
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

  async listTeam(companyId: string, query?: Record<string, string | undefined>) {
    const pagination = this.parsePagination(query);
    if (!pagination) {
      return this.prisma.companyMembership.findMany({
        where: { companyId },
        include: { user: true, roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' }
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.companyMembership.findMany({
        where: { companyId },
        include: { user: true, roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      }),
      this.prisma.companyMembership.count({ where: { companyId } })
    ]);

    return this.toPage(items, pagination.page, pagination.limit, total);
  }

  async listInvites(companyId: string, query?: Record<string, string | undefined>) {
    const pagination = this.parsePagination(query);
    if (!pagination) {
      return this.prisma.companyInvite.findMany({
        where: { companyId },
        include: { role: true, createdByUser: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.companyInvite.findMany({
        where: { companyId },
        include: { role: true, createdByUser: true },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      }),
      this.prisma.companyInvite.count({ where: { companyId } })
    ]);

    return this.toPage(items, pagination.page, pagination.limit, total);
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

  listRoleTemplates() {
    return ROLE_TEMPLATES.map((template) => ({
      key: template.key,
      name: template.name,
      description: template.description,
      permissionCount: template.permissionKeys.length
    }));
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

  async applyRoleTemplate(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = applyRoleTemplateSchema.parse(payload);

    const membership = await this.prisma.companyMembership.findUnique({ where: { id: body.membershipId } });
    if (!membership || membership.companyId !== companyId) {
      throw new NotFoundException('Membership not found');
    }

    await this.ensureRoleTemplates(this.prisma, companyId);

    const role = await this.prisma.companyRole.findUnique({
      where: { companyId_key: { companyId, key: body.template } }
    });

    if (!role) {
      throw new NotFoundException('Role template not found');
    }

    await this.prisma.companyMemberRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
      create: { membershipId: membership.id, roleId: role.id },
      update: {}
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.role_template.apply',
      entityType: 'company_membership',
      entityId: membership.id,
      metadata: {
        template: body.template,
        roleId: role.id,
        membershipId: membership.id
      },
      ip,
      userAgent
    });

    return { success: true, roleId: role.id };
  }

  listOrgDepartments(companyId: string) {
    return this.prisma.companyDepartment.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            children: true,
            titles: true
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    }).then((rows) =>
      rows.map((row) => ({
        ...row,
        canDelete: row._count.children === 0 && row._count.titles === 0,
        deleteBlockReason:
          row._count.children > 0
            ? 'Department has child departments'
            : row._count.titles > 0
              ? 'Department has titles'
              : null
      }))
    );
  }

  async createOrgDepartment(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    try {
      const body = companyDepartmentSchema.parse(payload);
      if (body.parentId) {
        const parent = await this.prisma.companyDepartment.findUnique({ where: { id: body.parentId } });
        if (!parent || parent.companyId !== companyId) {
          throw new ForbiddenException('Parent department is not owned by tenant');
        }
      }

      const row = await this.prisma.companyDepartment.create({
        data: {
          companyId,
          name: body.name,
          sortOrder: body.sortOrder ?? 1000,
          parentId: body.parentId ?? null,
          tipDepartment: body.tipDepartment ?? 'OTHER',
          isActive: body.isActive ?? true
        }
      });

      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.department.create',
        entityType: 'company_department',
        entityId: row.id,
        metadata: { ...body, success: true },
        ip,
        userAgent
      });

      return row;
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.department.create',
        entityType: 'company_department',
        entityId: undefined,
        metadata: { payload: this.safeJson(payload), success: false, reason: this.errorReason(error) },
        ip,
        userAgent
      });
      throw error;
    }
  }

  async updateOrgDepartment(
    actorUserId: string,
    companyId: string,
    departmentId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    try {
      const body = companyDepartmentSchema.partial().parse(payload);
      const existing = await this.prisma.companyDepartment.findUnique({ where: { id: departmentId } });
      if (!existing || existing.companyId !== companyId) {
        throw new NotFoundException('Department not found');
      }
      if (body.parentId) {
        if (body.parentId === departmentId) {
          throw new BadRequestException('Department cannot be its own parent');
        }
        const parent = await this.prisma.companyDepartment.findUnique({ where: { id: body.parentId } });
        if (!parent || parent.companyId !== companyId) {
          throw new ForbiddenException('Parent department is not owned by tenant');
        }
        await this.assertNoDepartmentCycle(companyId, departmentId, body.parentId);
      }

      const row = await this.prisma.companyDepartment.update({
        where: { id: departmentId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
          ...(body.tipDepartment !== undefined ? { tipDepartment: body.tipDepartment } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
        }
      });

      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.department.update',
        entityType: 'company_department',
        entityId: row.id,
        metadata: { ...body, success: true },
        ip,
        userAgent
      });

      return row;
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.department.update',
        entityType: 'company_department',
        entityId: departmentId,
        metadata: { payload: this.safeJson(payload), success: false, reason: this.errorReason(error) },
        ip,
        userAgent
      });
      throw error;
    }
  }

  async setOrgDepartmentActive(
    actorUserId: string,
    companyId: string,
    departmentId: string,
    isActive: boolean,
    ip?: string,
    userAgent?: string
  ) {
    try {
      const existing = await this.prisma.companyDepartment.findUnique({ where: { id: departmentId } });
      if (!existing || existing.companyId !== companyId) {
        throw new NotFoundException('Department not found');
      }
      const row = await this.prisma.companyDepartment.update({
        where: { id: departmentId },
        data: { isActive }
      });
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: isActive ? 'company.org.department.activate' : 'company.org.department.deactivate',
        entityType: 'company_department',
        entityId: departmentId,
        metadata: { success: true, isActive },
        ip,
        userAgent
      });
      return row;
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: isActive ? 'company.org.department.activate' : 'company.org.department.deactivate',
        entityType: 'company_department',
        entityId: departmentId,
        metadata: { success: false, reason: this.errorReason(error), isActive },
        ip,
        userAgent
      });
      throw error;
    }
  }

  async deleteOrgDepartment(actorUserId: string, companyId: string, departmentId: string, ip?: string, userAgent?: string) {
    try {
      const existing = await this.prisma.companyDepartment.findUnique({
        where: { id: departmentId },
        include: { _count: { select: { children: true, titles: true } } }
      });
      if (!existing || existing.companyId !== companyId) {
        throw new NotFoundException('Department not found');
      }
      if (existing._count.children > 0) {
        throw new ConflictException('Department has child departments and cannot be deleted');
      }
      if (existing._count.titles > 0) {
        throw new ConflictException('Department has titles and cannot be deleted');
      }
      await this.prisma.companyDepartment.delete({ where: { id: departmentId } });
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.department.delete',
        entityType: 'company_department',
        entityId: departmentId,
        metadata: { success: true },
        ip,
        userAgent
      });
      return { success: true };
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.department.delete',
        entityType: 'company_department',
        entityId: departmentId,
        metadata: { success: false, reason: this.errorReason(error) },
        ip,
        userAgent
      });
      throw error;
    }
  }

  listOrgTitles(companyId: string) {
    return this.prisma.companyTitle.findMany({
      where: { companyId },
      include: {
        department: true,
        _count: { select: { employees: true } }
      },
      orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }]
    }).then((rows) =>
      rows.map((row) => ({
        ...row,
        canDelete: row._count.employees === 0,
        deleteBlockReason: row._count.employees > 0 ? 'Title is assigned to employees' : null
      }))
    );
  }

  async createOrgTitle(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    try {
      const body = companyTitleSchema.parse(payload);
      const department = await this.prisma.companyDepartment.findUnique({ where: { id: body.departmentId } });
      if (!department || department.companyId !== companyId) {
        throw new ForbiddenException('Department is not owned by tenant');
      }

      const row = await this.prisma.companyTitle.create({
        data: {
          companyId,
          departmentId: body.departmentId,
          name: body.name,
          sortOrder: body.sortOrder ?? 1000,
          tipWeight: new Prisma.Decimal(body.tipWeight),
          isTipEligible: body.isTipEligible,
          departmentAggregate: body.departmentAggregate,
          isActive: body.isActive ?? true
        },
        include: { department: true }
      });

      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.title.create',
        entityType: 'company_title',
        entityId: row.id,
        metadata: { ...body, success: true },
        ip,
        userAgent
      });

      return row;
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.title.create',
        entityType: 'company_title',
        entityId: undefined,
        metadata: { payload: this.safeJson(payload), success: false, reason: this.errorReason(error) },
        ip,
        userAgent
      });
      throw error;
    }
  }

  async updateOrgTitle(actorUserId: string, companyId: string, titleId: string, payload: unknown, ip?: string, userAgent?: string) {
    try {
      const body = companyTitleSchema.partial().parse(payload);
      const existing = await this.prisma.companyTitle.findUnique({ where: { id: titleId } });
      if (!existing || existing.companyId !== companyId) {
        throw new NotFoundException('Title not found');
      }
      if (body.departmentId) {
        const department = await this.prisma.companyDepartment.findUnique({ where: { id: body.departmentId } });
        if (!department || department.companyId !== companyId) {
          throw new ForbiddenException('Department is not owned by tenant');
        }
      }

      const row = await this.prisma.companyTitle.update({
        where: { id: titleId },
        data: {
          ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.tipWeight !== undefined ? { tipWeight: new Prisma.Decimal(body.tipWeight) } : {}),
          ...(body.isTipEligible !== undefined ? { isTipEligible: body.isTipEligible } : {}),
          ...(body.departmentAggregate !== undefined ? { departmentAggregate: body.departmentAggregate } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
        },
        include: { department: true }
      });

      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.title.update',
        entityType: 'company_title',
        entityId: row.id,
        metadata: { ...body, success: true },
        ip,
        userAgent
      });

      return row;
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.title.update',
        entityType: 'company_title',
        entityId: titleId,
        metadata: { payload: this.safeJson(payload), success: false, reason: this.errorReason(error) },
        ip,
        userAgent
      });
      throw error;
    }
  }

  async setOrgTitleActive(actorUserId: string, companyId: string, titleId: string, isActive: boolean, ip?: string, userAgent?: string) {
    try {
      const existing = await this.prisma.companyTitle.findUnique({ where: { id: titleId } });
      if (!existing || existing.companyId !== companyId) {
        throw new NotFoundException('Title not found');
      }
      const row = await this.prisma.companyTitle.update({
        where: { id: titleId },
        data: { isActive },
        include: { department: true }
      });
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: isActive ? 'company.org.title.activate' : 'company.org.title.deactivate',
        entityType: 'company_title',
        entityId: titleId,
        metadata: { success: true, isActive },
        ip,
        userAgent
      });
      return row;
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: isActive ? 'company.org.title.activate' : 'company.org.title.deactivate',
        entityType: 'company_title',
        entityId: titleId,
        metadata: { success: false, reason: this.errorReason(error), isActive },
        ip,
        userAgent
      });
      throw error;
    }
  }

  async deleteOrgTitle(actorUserId: string, companyId: string, titleId: string, ip?: string, userAgent?: string) {
    try {
      const existing = await this.prisma.companyTitle.findUnique({
        where: { id: titleId },
        include: { _count: { select: { employees: true } } }
      });
      if (!existing || existing.companyId !== companyId) {
        throw new NotFoundException('Title not found');
      }
      if (existing._count.employees > 0) {
        throw new ConflictException('Title is assigned to employees and cannot be deleted');
      }
      await this.prisma.companyTitle.delete({ where: { id: titleId } });
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.title.delete',
        entityType: 'company_title',
        entityId: titleId,
        metadata: { success: true },
        ip,
        userAgent
      });
      return { success: true };
    } catch (error) {
      await this.audit.logCompany({
        actorUserId,
        companyId,
        action: 'company.org.title.delete',
        entityType: 'company_title',
        entityId: titleId,
        metadata: { success: false, reason: this.errorReason(error) },
        ip,
        userAgent
      });
      throw error;
    }
  }

  listOrgEmployees(companyId: string) {
    return this.prisma.companyEmployeeDirectory.findMany({
      where: { companyId },
      include: { title: { include: { department: true } }, user: true },
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }, { lastName: 'asc' }]
    });
  }

  async createOrgEmployee(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = companyEmployeeDirectorySchema.parse(payload);
    await this.validateOrgEmployeeRefs(companyId, body.titleId, body.userId ?? null);
    const row = await this.prisma.companyEmployeeDirectory.create({
      data: {
        companyId,
        firstName: body.firstName,
        lastName: body.lastName,
        userId: body.userId ?? null,
        titleId: body.titleId,
        isActive: body.isActive ?? true
      },
      include: { title: { include: { department: true } }, user: true }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.org.employee.create',
      entityType: 'company_employee_directory',
      entityId: row.id,
      metadata: body,
      ip,
      userAgent
    });

    return row;
  }

  async updateOrgEmployee(
    actorUserId: string,
    companyId: string,
    employeeId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = companyEmployeeDirectorySchema.partial().parse(payload);
    const existing = await this.prisma.companyEmployeeDirectory.findUnique({ where: { id: employeeId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException('Directory employee not found');
    }
    await this.validateOrgEmployeeRefs(
      companyId,
      body.titleId ?? existing.titleId,
      body.userId === undefined ? existing.userId : body.userId
    );

    const row = await this.prisma.companyEmployeeDirectory.update({
      where: { id: employeeId },
      data: {
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.userId !== undefined ? { userId: body.userId } : {}),
        ...(body.titleId !== undefined ? { titleId: body.titleId } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      },
      include: { title: { include: { department: true } }, user: true }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.org.employee.update',
      entityType: 'company_employee_directory',
      entityId: row.id,
      metadata: body,
      ip,
      userAgent
    });

    return row;
  }

  async listAuditLogs(companyId: string, query?: Record<string, string | undefined>) {
    const pagination = this.parsePagination(query);
    if (!pagination) {
      return this.prisma.companyAuditLog.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.companyAuditLog.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      }),
      this.prisma.companyAuditLog.count({ where: { companyId } })
    ]);

    return this.toPage(items, pagination.page, pagination.limit, total);
  }

  async listInstalledModules(companyId: string, query?: Record<string, string | undefined>) {
    const pagination = this.parsePagination(query);
    if (!pagination) {
      return this.prisma.moduleInstallation.findMany({
        where: { companyId, status: 'ACTIVE' },
        include: { module: true },
        orderBy: { createdAt: 'asc' }
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.moduleInstallation.findMany({
        where: { companyId, status: 'ACTIVE' },
        include: { module: true },
        orderBy: { createdAt: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      }),
      this.prisma.moduleInstallation.count({ where: { companyId, status: 'ACTIVE' } })
    ]);

    return this.toPage(items, pagination.page, pagination.limit, total);
  }

  async listModuleCatalog(companyId: string, query?: Record<string, string | undefined>) {
    const pagination = this.parsePagination(query);

    const [installations, entitlements] = await Promise.all([
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

    if (!pagination) {
      const catalog = await this.prisma.module.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'asc' }
      });

      return catalog.map((module) => ({
        ...module,
        installed: installedKeys.has(module.key),
        entitlementLimits: entitlementByKey.get(module.key) ?? null
      }));
    }

    const [catalog, total] = await Promise.all([
      this.prisma.module.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      }),
      this.prisma.module.count({ where: { status: 'PUBLISHED' } })
    ]);

    return this.toPage(
      catalog.map((module) => ({
        ...module,
        installed: installedKeys.has(module.key),
        entitlementLimits: entitlementByKey.get(module.key) ?? null
      })),
      pagination.page,
      pagination.limit,
      total
    );
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

  async onboardingCompanyBasics(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = onboardingCompanyBasicsSchema.parse(payload);
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: body.name,
        ...(body.locale ? { locale: body.locale } : {}),
        onboardingStep: { set: 2 }
      }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.onboarding.company_basics',
      entityType: 'company',
      entityId: company.id,
      metadata: { name: body.name, locale: body.locale ?? null, step: 2 },
      ip,
      userAgent
    });

    return company;
  }

  async onboardingProfitCenters(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = onboardingProfitCentersSchema.parse(payload);

    for (const name of [...new Set(body.names.map((row) => row.trim()))]) {
      if (!name) continue;
      await this.prisma.financeProfitCenter.upsert({
        where: { companyId_name: { companyId, name } },
        create: { companyId, name, type: 'GENERAL', isActive: true },
        update: { isActive: true }
      });
    }

    await this.advanceOnboarding(companyId, 3);

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.onboarding.profit_centers',
      entityType: 'finance_profit_center',
      entityId: undefined,
      metadata: { names: body.names, count: body.names.length, step: 3 },
      ip,
      userAgent
    });

    return this.onboardingStatus(companyId);
  }

  async onboardingInventoryBootstrap(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = onboardingInventoryBootstrapSchema.parse(payload);

    const warehouse = await this.prisma.inventoryWarehouse.upsert({
      where: { companyId_name: { companyId, name: body.warehouseName.trim() } },
      create: {
        companyId,
        name: body.warehouseName.trim(),
        location: 'Onboarding warehouse'
      },
      update: { isActive: true }
    });

    const item = await this.prisma.inventoryItem.create({
      data: {
        companyId,
        name: body.itemName,
        sku: `ONB-${Date.now()}`,
        unit: body.unit,
        lastPurchaseUnitCost: 10,
        isActive: true
      }
    });

    await this.prisma.inventoryStockMovement.create({
      data: {
        companyId,
        itemId: item.id,
        warehouseId: warehouse.id,
        type: 'IN',
        quantity: new Prisma.Decimal(body.initialStock),
        reference: 'onboarding-initial-stock',
        relatedDocumentType: 'manual',
        relatedDocumentId: companyId,
        createdByUserId: actorUserId
      }
    });

    await this.advanceOnboarding(companyId, 4);

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.onboarding.inventory_bootstrap',
      entityType: 'inventory_item',
      entityId: item.id,
      metadata: {
        warehouseId: warehouse.id,
        itemId: item.id,
        initialStock: body.initialStock,
        step: 4
      },
      ip,
      userAgent
    });

    return { warehouse, item };
  }

  async onboardingEmployee(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = onboardingEmployeeSchema.parse(payload);

    const employee = await this.prisma.employee.create({
      data: {
        companyId,
        firstName: body.firstName,
        lastName: body.lastName,
        hireDate: new Date(),
        salaryType: (body.salaryType === 'fixed' ? 'FIXED' : 'HOURLY') as SalaryType,
        baseSalary: body.salaryType === 'fixed' ? new Prisma.Decimal(body.baseSalary) : null,
        hourlyRate: body.salaryType === 'hourly' ? new Prisma.Decimal(body.hourlyRate) : null,
        isActive: true
      }
    });

    await this.advanceOnboarding(companyId, 5);

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.onboarding.employee',
      entityType: 'employee',
      entityId: employee.id,
      metadata: {
        salaryType: employee.salaryType,
        baseSalary: employee.baseSalary,
        hourlyRate: employee.hourlyRate,
        step: 5
      },
      ip,
      userAgent
    });

    return employee;
  }

  async onboardingFirstSalesOrder(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = onboardingFirstSalesOrderSchema.parse(payload);

    const warehouse =
      (await this.prisma.inventoryWarehouse.findFirst({ where: { companyId, isActive: true }, orderBy: { createdAt: 'asc' } })) ??
      (await this.prisma.inventoryWarehouse.create({
        data: { companyId, name: 'Default Warehouse', location: 'Onboarding default' }
      }));

    const product = await this.prisma.salesProduct.create({
      data: {
        companyId,
        name: body.productName,
        sku: `ONB-SP-${Date.now()}`,
        salesPrice: body.unitPrice,
        isActive: true
      }
    });

    const [revenueCategory, cogsCategory] = await this.ensureSalesFinanceCategories(companyId);
    const orderDate = new Date();
    const totalRevenue = Number((body.quantity * body.unitPrice).toFixed(2));
    const totalCogs = Number((totalRevenue * 0.4).toFixed(2));

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.salesOrder.create({
        data: {
          companyId,
          orderNo: `ONB-${Date.now()}`,
          orderDate,
          status: 'POSTED',
          warehouseId: warehouse.id,
          currency: 'TRY',
          totalRevenue: new Prisma.Decimal(totalRevenue),
          totalCogs: new Prisma.Decimal(totalCogs),
          notes: body.notes ?? 'Onboarding first sales order',
          createdByUserId: actorUserId
        }
      });

      await tx.salesOrderLine.create({
        data: {
          companyId,
          salesOrderId: createdOrder.id,
          productId: product.id,
          quantity: new Prisma.Decimal(body.quantity),
          unitPrice: new Prisma.Decimal(body.unitPrice),
          lineTotal: new Prisma.Decimal(totalRevenue)
        }
      });

      await tx.financeEntry.createMany({
        data: [
          {
            companyId,
            categoryId: revenueCategory.id,
            amount: new Prisma.Decimal(totalRevenue),
            date: orderDate,
            description: 'Onboarding sales revenue',
            reference: createdOrder.orderNo,
            relatedDocumentType: 'sale',
            relatedDocumentId: createdOrder.id,
            createdByUserId: actorUserId
          },
          {
            companyId,
            categoryId: cogsCategory.id,
            amount: new Prisma.Decimal(totalCogs),
            date: orderDate,
            description: 'Onboarding COGS',
            reference: createdOrder.orderNo,
            relatedDocumentType: 'sale',
            relatedDocumentId: createdOrder.id,
            createdByUserId: actorUserId
          }
        ]
      });

      return createdOrder;
    });

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        onboardingStep: 6,
        onboardingCompleted: true
      }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.onboarding.first_sales_order',
      entityType: 'sales_order',
      entityId: order.id,
      metadata: { productId: product.id, totalRevenue, totalCogs, completed: true },
      ip,
      userAgent
    });

    return order;
  }

  async generateDemo(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = demoGenerateSchema.parse(payload ?? {});
    const tag = body.tag ?? `demo-${new Date().toISOString().slice(0, 10)}`;

    const [revenueCategory, expenseCategory, cogsCategory] = await this.ensureDemoFinanceCategories(companyId);

    const result = await this.prisma.$transaction(async (tx) => {
      const profitCenters = [] as Array<{ id: string; name: string }>;
      for (const name of ['Demo Dining', 'Demo Delivery', 'Demo Events']) {
        const center = await tx.financeProfitCenter.upsert({
          where: { companyId_name: { companyId, name } },
          create: { companyId, name, type: 'GENERAL', isActive: true },
          update: { isActive: true }
        });
        profitCenters.push({ id: center.id, name: center.name });
      }

      const warehouse = await tx.inventoryWarehouse.upsert({
        where: { companyId_name: { companyId, name: `DEMO Warehouse ${tag}` } },
        create: { companyId, name: `DEMO Warehouse ${tag}`, location: 'Demo location', isActive: true },
        update: { isActive: true }
      });

      const items: Array<{ id: string; name: string }> = [];
      for (let i = 1; i <= 20; i += 1) {
        const item = await tx.inventoryItem.create({
          data: {
            companyId,
            name: `DEMO Item ${i} (${tag})`,
            sku: `DEMO-${tag}-${i}-${Date.now()}`,
            unit: 'piece',
            lastPurchaseUnitCost: new Prisma.Decimal((5 + (i % 7) * 2).toFixed(2)),
            isActive: true
          }
        });
        items.push({ id: item.id, name: item.name });

        await tx.inventoryStockMovement.create({
          data: {
            companyId,
            itemId: item.id,
            warehouseId: warehouse.id,
            type: 'IN',
            quantity: new Prisma.Decimal(40 + i),
            reference: `DEMO:${tag}:stock`,
            relatedDocumentType: 'manual',
            relatedDocumentId: tag,
            createdByUserId: actorUserId
          }
        });
      }

      const employees: Array<{ id: string; firstName: string; lastName: string; employmentRecordId: string }> = [];
      for (let i = 1; i <= 5; i += 1) {
        const employee = await tx.employee.create({
          data: {
            companyId,
            firstName: `Demo${i}`,
            lastName: 'Employee',
            hireDate: new Date(),
            salaryType: 'FIXED',
            baseSalary: new Prisma.Decimal(9000 + i * 750),
            isActive: true
          }
        });
        const employmentRecord = await tx.payrollEmploymentRecord.findFirst({
          where: { companyId, employeeId: employee.id },
          orderBy: { createdAt: 'asc' }
        });

        if (!employmentRecord) {
          throw new Error(`Payroll employment record missing for demo employee ${employee.id}`);
        }

        employees.push({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employmentRecordId: employmentRecord.id
        });
      }

      const payrollPeriod = await tx.payrollPeriod.create({
        data: {
          companyId,
          startDate: this.startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
          endDate: this.endOfDay(new Date()),
          status: 'CALCULATED',
          totalGross: new Prisma.Decimal(0),
          totalNet: new Prisma.Decimal(0)
        }
      });

      let payrollTotal = 0;
      for (const employee of employees) {
        const gross = 10000;
        payrollTotal += gross;
        await tx.payrollLine.create({
          data: {
            companyId,
            payrollPeriodId: payrollPeriod.id,
            employeeId: employee.id,
            employmentRecordId: employee.employmentRecordId,
            grossAmount: new Prisma.Decimal(gross),
            notes: `DEMO:${tag}`
          }
        });
      }

      await tx.payrollPeriod.update({
        where: { id: payrollPeriod.id },
        data: {
          totalGross: new Prisma.Decimal(payrollTotal),
          totalNet: new Prisma.Decimal(payrollTotal)
        }
      });

      for (let i = 0; i < 3; i += 1) {
        const rule = await tx.financeAllocationRule.create({
          data: {
            companyId,
            name: `DEMO Allocation ${i + 1} (${tag})`,
            sourceCategoryId: expenseCategory.id,
            allocationMethod: 'PERCENTAGE',
            isActive: true
          }
        });

        await tx.financeAllocationTarget.createMany({
          data: [
            { allocationRuleId: rule.id, profitCenterId: profitCenters[0].id, percentage: new Prisma.Decimal(50) },
            { allocationRuleId: rule.id, profitCenterId: profitCenters[1].id, percentage: new Prisma.Decimal(30) },
            { allocationRuleId: rule.id, profitCenterId: profitCenters[2].id, percentage: new Prisma.Decimal(20) }
          ]
        });
      }

      for (let i = 0; i < 30; i += 1) {
        const date = new Date();
        date.setDate(date.getDate() - (i % 14));
        await tx.reservation.create({
          data: {
            companyId,
            name: `DEMO Guest ${i + 1}`,
            reservationDate: this.startOfDay(date),
            reservationTime: new Date(this.startOfDay(date).getTime() + 19 * 60 * 60 * 1000),
            guestCount: 2 + (i % 4),
            status: i % 7 === 0 ? 'NO_SHOW' : i % 6 === 0 ? 'CANCELED' : 'COMPLETED',
            tableRef: `T-${(i % 12) + 1}`,
            notes: `DEMO:${tag}`,
            createdByUserId: actorUserId
          }
        });
      }

      const products = [] as Array<{ id: string; name: string }>;
      for (let i = 1; i <= 5; i += 1) {
        const product = await tx.salesProduct.create({
          data: {
            companyId,
            name: `DEMO Product ${i}`,
            sku: `DEMO-P-${tag}-${i}-${Date.now()}`,
            salesPrice: new Prisma.Decimal(70 + i * 10),
            isActive: true
          }
        });
        products.push({ id: product.id, name: product.name });
      }

      const today = new Date();
      for (let i = 0; i < 50; i += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - (i % 25));
        const product = products[i % products.length];
        const quantity = (i % 4) + 1;
        const unitPrice = 80 + (i % 5) * 15;
        const revenue = Number((quantity * unitPrice).toFixed(2));
        const cogs = Number((revenue * 0.42).toFixed(2));

        const order = await tx.salesOrder.create({
          data: {
            companyId,
            orderNo: `DEMO-SO-${tag}-${i + 1}`,
            orderDate: date,
            status: 'POSTED',
            warehouseId: warehouse.id,
            totalRevenue: new Prisma.Decimal(revenue),
            totalCogs: new Prisma.Decimal(cogs),
            notes: `DEMO:${tag}`,
            createdByUserId: actorUserId,
            profitCenterId: profitCenters[i % profitCenters.length].id
          }
        });

        await tx.salesOrderLine.create({
          data: {
            companyId,
            salesOrderId: order.id,
            productId: product.id,
            quantity: new Prisma.Decimal(quantity),
            unitPrice: new Prisma.Decimal(unitPrice),
            lineTotal: new Prisma.Decimal(revenue)
          }
        });

        await tx.financeEntry.createMany({
          data: [
            {
              companyId,
              categoryId: revenueCategory.id,
              amount: new Prisma.Decimal(revenue),
              date,
              description: `DEMO Revenue ${tag}`,
              reference: `DEMO-SO-${i + 1}`,
              relatedDocumentType: 'sale',
              relatedDocumentId: order.id,
              createdByUserId: actorUserId,
              profitCenterId: order.profitCenterId
            },
            {
              companyId,
              categoryId: cogsCategory.id,
              amount: new Prisma.Decimal(cogs),
              date,
              description: `DEMO COGS ${tag}`,
              reference: `DEMO-SO-${i + 1}`,
              relatedDocumentType: 'sale',
              relatedDocumentId: order.id,
              createdByUserId: actorUserId,
              profitCenterId: order.profitCenterId
            }
          ]
        });
      }

      for (let i = 0; i < 20; i += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - (i % 20));
        const isIncome = i % 3 !== 0;
        await tx.financeEntry.create({
          data: {
            companyId,
            categoryId: isIncome ? revenueCategory.id : expenseCategory.id,
            amount: new Prisma.Decimal(250 + i * 12),
            date,
            description: `DEMO Random ${tag}`,
            reference: `DEMO-RND-${i + 1}`,
            relatedDocumentType: 'demo',
            relatedDocumentId: tag,
            createdByUserId: actorUserId
          }
        });
      }

      await tx.company.update({
        where: { id: companyId },
        data: { onboardingCompleted: true, onboardingStep: 6 }
      });

      return {
        tag,
        profitCenters: 3,
        inventoryItems: items.length,
        sales: 50,
        reservations: 30,
        employees: employees.length,
        payrollPeriods: 1,
        allocationRules: 3,
        randomFinanceEntries: 20
      };
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.demo.generate',
      entityType: 'company',
      entityId: companyId,
      metadata: result,
      ip,
      userAgent
    });

    return result;
  }

  private async ensureRoleTemplates(tx: Prisma.TransactionClient | PrismaService, companyId: string) {
    const ownerTemplate = ROLE_TEMPLATES.find((row) => row.key === 'owner');
    if (!ownerTemplate) return;

    const allTemplatePermissionKeys = new Set<string>();
    for (const template of ROLE_TEMPLATES) {
      for (const key of template.permissionKeys) {
        allTemplatePermissionKeys.add(key);
      }
    }

    for (const key of allTemplatePermissionKeys) {
      await tx.companyPermission.upsert({
        where: { key },
        create: { key },
        update: {}
      });
    }

    const existingPermissions = await tx.companyPermission.findMany({ select: { id: true, key: true } });
    const permissionIdByKey = new Map(existingPermissions.map((row) => [row.key, row.id]));

    const ownerRole = await tx.companyRole.upsert({
      where: { companyId_key: { companyId, key: 'owner' } },
      create: { companyId, key: 'owner', name: 'Owner', description: ownerTemplate.description },
      update: { name: 'Owner', description: ownerTemplate.description }
    });

    for (const permission of existingPermissions) {
      await tx.companyRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: ownerRole.id,
            permissionId: permission.id
          }
        },
        create: { roleId: ownerRole.id, permissionId: permission.id },
        update: {}
      });
    }

    for (const template of ROLE_TEMPLATES.filter((row) => row.key !== 'owner')) {
      const role = await tx.companyRole.upsert({
        where: { companyId_key: { companyId, key: template.key } },
        create: {
          companyId,
          key: template.key,
          name: template.name,
          description: template.description
        },
        update: {
          name: template.name,
          description: template.description
        }
      });

      for (const permissionKey of template.permissionKeys) {
        const permissionId = permissionIdByKey.get(permissionKey);
        if (!permissionId) continue;
        await tx.companyRolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId
            }
          },
          create: { roleId: role.id, permissionId },
          update: {}
        });
      }
    }
  }

  private async ensurePilotModulesInstalled(tx: Prisma.TransactionClient, companyId: string) {
    const modules = await tx.module.findMany({
      where: { key: { in: [...PILOT_MODULE_KEYS] }, status: 'PUBLISHED' },
      select: { key: true }
    });

    for (const row of modules) {
      await tx.moduleInstallation.upsert({
        where: { companyId_moduleKey: { companyId, moduleKey: row.key } },
        create: {
          companyId,
          moduleKey: row.key,
          status: 'ACTIVE',
          installedAt: new Date()
        },
        update: {
          status: 'ACTIVE',
          installedAt: new Date()
        }
      });

      await tx.companyEntitlement.upsert({
        where: { companyId_moduleKey: { companyId, moduleKey: row.key } },
        create: { companyId, moduleKey: row.key, limits: {} },
        update: {}
      });
    }
  }

  private async ensureSalesFinanceCategories(companyId: string) {
    const revenue = await this.prisma.financeCategory.upsert({
      where: { companyId_name: { companyId, name: 'Sales Revenue' } },
      create: { companyId, name: 'Sales Revenue', type: 'INCOME' },
      update: {}
    });

    const cogs = await this.prisma.financeCategory.upsert({
      where: { companyId_name: { companyId, name: 'COGS' } },
      create: { companyId, name: 'COGS', type: 'EXPENSE' },
      update: {}
    });

    return [revenue, cogs] as const;
  }

  private async ensureDemoFinanceCategories(companyId: string) {
    const [revenue, cogs] = await this.ensureSalesFinanceCategories(companyId);
    const expense = await this.prisma.financeCategory.upsert({
      where: { companyId_name: { companyId, name: 'Operating Expense' } },
      create: { companyId, name: 'Operating Expense', type: 'EXPENSE' },
      update: {}
    });
    return [revenue, expense, cogs] as const;
  }

  private async advanceOnboarding(companyId: string, step: number) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    if (company.onboardingCompleted) return company;

    return this.prisma.company.update({
      where: { id: companyId },
      data: { onboardingStep: Math.max(company.onboardingStep, step) }
    });
  }

  private async validateOrgEmployeeRefs(companyId: string, titleId: string, userId: string | null) {
    const title = await this.prisma.companyTitle.findUnique({ where: { id: titleId } });
    if (!title || title.companyId !== companyId) {
      throw new ForbiddenException('Title is not owned by tenant');
    }

    if (!userId) return;
    const membership = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } }
    });
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('User is not an active company member');
    }
  }

  private async assertNoDepartmentCycle(companyId: string, departmentId: string, parentId: string) {
    let cursor: string | null = parentId;
    while (cursor) {
      const currentId: string = cursor;
      if (currentId === departmentId) {
        throw new BadRequestException('Department hierarchy cycle is not allowed');
      }
      const row: { parentId: string | null; companyId: string } | null = await this.prisma.companyDepartment.findUnique({
        where: { id: currentId },
        select: { parentId: true, companyId: true }
      });
      if (!row || row.companyId !== companyId) {
        throw new ForbiddenException('Parent department is not owned by tenant');
      }
      cursor = row.parentId;
    }
  }

  private errorReason(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private safeJson(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch {
      return String(value);
    }
  }

  private parsePagination(query?: Record<string, string | undefined>) {
    if (!query) return null;
    if (!query.page && !query.limit) return null;
    return paginationQuerySchema.parse(query);
  }

  private toPage<T>(items: T[], page: number, limit: number, total: number): Paginated<T> {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { items, page, limit, total, totalPages };
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

  private startOfDay(value: Date) {
    const out = new Date(value);
    out.setHours(0, 0, 0, 0);
    return out;
  }

  private endOfDay(value: Date) {
    const out = new Date(value);
    out.setHours(23, 59, 59, 999);
    return out;
  }
}
