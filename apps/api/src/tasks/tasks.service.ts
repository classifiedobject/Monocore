import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TaskScheduleType } from '@prisma/client';
import {
  taskBoardSchema,
  taskCommentSchema,
  taskGenerateQuerySchema,
  taskInstanceSchema,
  taskQuerySchema,
  taskTemplateSchema
} from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

@Injectable()
export class TasksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async capabilities(userId: string, companyId: string) {
    const membership = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Company membership required');
    }

    const keys = new Set(membership.roles.flatMap((row) => row.role.permissions.map((perm) => perm.permission.key)));
    return {
      permissions: Array.from(keys),
      manageTemplate: keys.has('module:task-core.template.manage'),
      manageTask: keys.has('module:task-core.task.manage'),
      readTask: keys.has('module:task-core.task.read'),
      completeTask: keys.has('module:task-core.task.complete'),
      readReports: keys.has('module:task-core.reports.read')
    };
  }

  listBoards(companyId: string) {
    return this.prisma.taskBoard.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    });
  }

  async createBoard(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = taskBoardSchema.parse(payload);
    const board = await this.prisma.taskBoard.create({
      data: {
        companyId,
        name: body.name
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.board.create', 'task_board', board.id, body, ip, userAgent);
    return board;
  }

  async updateBoard(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = taskBoardSchema.partial().parse(payload);
    const board = await this.requireBoard(companyId, id);

    const updated = await this.prisma.taskBoard.update({
      where: { id: board.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.board.update', 'task_board', updated.id, body, ip, userAgent);
    return updated;
  }

  listTemplates(companyId: string) {
    return this.prisma.taskTemplate.findMany({
      where: { companyId },
      include: {
        board: true,
        defaultAssigneeUser: true,
        defaultAssigneeRole: true,
        _count: { select: { taskInstances: true } }
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createTemplate(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = taskTemplateSchema.parse(payload);
    await this.validateTemplateReferences(companyId, body);

    const row = await this.prisma.taskTemplate.create({
      data: {
        companyId,
        boardId: body.boardId ?? null,
        title: body.title,
        description: body.description ?? null,
        priority: body.priority,
        scheduleType: body.scheduleType,
        scheduleMeta: body.scheduleMeta ?? Prisma.JsonNull,
        defaultAssigneeType: body.defaultAssigneeType,
        defaultAssigneeUserId: body.defaultAssigneeUserId ?? null,
        defaultAssigneeRoleId: body.defaultAssigneeRoleId ?? null,
        isActive: body.isActive ?? true,
        createdByUserId: actorUserId
      },
      include: {
        board: true,
        defaultAssigneeUser: true,
        defaultAssigneeRole: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.template.create', 'task_template', row.id, body, ip, userAgent);
    return row;
  }

  async updateTemplate(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = taskTemplateSchema.partial().parse(payload);
    const existing = await this.requireTemplate(companyId, id);

    const merged = {
      boardId: body.boardId === undefined ? existing.boardId : body.boardId,
      defaultAssigneeType: body.defaultAssigneeType === undefined ? existing.defaultAssigneeType : body.defaultAssigneeType,
      defaultAssigneeUserId: body.defaultAssigneeUserId === undefined ? existing.defaultAssigneeUserId : body.defaultAssigneeUserId,
      defaultAssigneeRoleId: body.defaultAssigneeRoleId === undefined ? existing.defaultAssigneeRoleId : body.defaultAssigneeRoleId
    };

    await this.validateTemplateReferences(companyId, merged);

    const row = await this.prisma.taskTemplate.update({
      where: { id: existing.id },
      data: {
        ...(body.boardId !== undefined ? { boardId: body.boardId } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.scheduleType !== undefined ? { scheduleType: body.scheduleType } : {}),
        ...(body.scheduleMeta !== undefined ? { scheduleMeta: body.scheduleMeta ?? Prisma.JsonNull } : {}),
        ...(body.defaultAssigneeType !== undefined ? { defaultAssigneeType: body.defaultAssigneeType } : {}),
        ...(body.defaultAssigneeUserId !== undefined ? { defaultAssigneeUserId: body.defaultAssigneeUserId } : {}),
        ...(body.defaultAssigneeRoleId !== undefined ? { defaultAssigneeRoleId: body.defaultAssigneeRoleId } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      },
      include: {
        board: true,
        defaultAssigneeUser: true,
        defaultAssigneeRole: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.template.update', 'task_template', row.id, body, ip, userAgent);
    return row;
  }

  async deactivateTemplate(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireTemplate(companyId, id);
    const row = await this.prisma.taskTemplate.update({
      where: { id: existing.id },
      data: { isActive: false }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.template.deactivate', 'task_template', row.id, {}, ip, userAgent);
    return row;
  }

  async listTasks(companyId: string, query: unknown) {
    const parsed = taskQuerySchema.parse(query);
    const todayStart = this.startOfDay(new Date());

    return this.prisma.taskInstance.findMany({
      where: {
        companyId,
        ...(parsed.from || parsed.to
          ? {
              dueDate: {
                ...(parsed.from ? { gte: this.parseDateValue(parsed.from, false) } : {}),
                ...(parsed.to ? { lte: this.parseDateValue(parsed.to, true) } : {})
              }
            }
          : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.assigneeUserId ? { assigneeUserId: parsed.assigneeUserId } : {}),
        ...(parsed.assigneeRoleId ? { assigneeRoleId: parsed.assigneeRoleId } : {}),
        ...(parsed.overdue === 'true' ? { dueDate: { lt: todayStart }, status: { not: 'DONE' } } : {})
      },
      include: {
        board: true,
        template: true,
        assigneeUser: true,
        assigneeRole: true,
        createdByUser: true
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async createTask(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = taskInstanceSchema.parse(payload);
    await this.validateTaskReferences(companyId, body);

    const row = await this.prisma.taskInstance.create({
      data: {
        companyId,
        templateId: body.templateId ?? null,
        boardId: body.boardId ?? null,
        title: body.title,
        description: body.description ?? null,
        priority: body.priority,
        dueDate: this.parseDateValue(body.dueDate),
        status: body.status ?? 'OPEN',
        assigneeUserId: body.assigneeUserId ?? null,
        assigneeRoleId: body.assigneeRoleId ?? null,
        createdByUserId: actorUserId,
        completedAt: body.status === 'DONE' ? new Date() : null
      },
      include: {
        board: true,
        template: true,
        assigneeUser: true,
        assigneeRole: true,
        createdByUser: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.instance.create', 'task_instance', row.id, body, ip, userAgent);
    return row;
  }

  async getTask(companyId: string, id: string) {
    return this.requireTask(companyId, id);
  }

  async updateTask(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = taskInstanceSchema.partial().parse(payload);
    const existing = await this.requireTask(companyId, id);
    await this.validateTaskReferences(companyId, body);

    const row = await this.prisma.taskInstance.update({
      where: { id: existing.id },
      data: {
        ...(body.templateId !== undefined ? { templateId: body.templateId } : {}),
        ...(body.boardId !== undefined ? { boardId: body.boardId } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.dueDate !== undefined ? { dueDate: this.parseDateValue(body.dueDate) } : {}),
        ...(body.status !== undefined ? { status: body.status, completedAt: body.status === 'DONE' ? new Date() : null } : {}),
        ...(body.assigneeUserId !== undefined ? { assigneeUserId: body.assigneeUserId } : {}),
        ...(body.assigneeRoleId !== undefined ? { assigneeRoleId: body.assigneeRoleId } : {})
      },
      include: {
        board: true,
        template: true,
        assigneeUser: true,
        assigneeRole: true,
        createdByUser: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.instance.update', 'task_instance', row.id, body, ip, userAgent);
    return row;
  }

  async completeTask(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireTask(companyId, id);
    const row = await this.prisma.taskInstance.update({
      where: { id: existing.id },
      data: { status: 'DONE', completedAt: new Date() },
      include: {
        board: true,
        template: true,
        assigneeUser: true,
        assigneeRole: true,
        createdByUser: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.instance.complete', 'task_instance', row.id, {}, ip, userAgent);
    return row;
  }

  async reopenTask(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireTask(companyId, id);
    const row = await this.prisma.taskInstance.update({
      where: { id: existing.id },
      data: { status: 'OPEN', completedAt: null },
      include: {
        board: true,
        template: true,
        assigneeUser: true,
        assigneeRole: true,
        createdByUser: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.instance.reopen', 'task_instance', row.id, {}, ip, userAgent);
    return row;
  }

  async generate(actorUserId: string, companyId: string, query: unknown, ip?: string, userAgent?: string) {
    const parsed = taskGenerateQuerySchema.parse(query);
    const from = this.parseDateValue(parsed.from, false);
    const to = this.parseDateValue(parsed.to, true);

    if (from > to) {
      throw new BadRequestException('Invalid date range');
    }

    const templates = await this.prisma.taskTemplate.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ createdAt: 'asc' }]
    });

    const generatedIds: string[] = [];

    for (const template of templates) {
      const days = this.generateTemplateDates(template.scheduleType, template.scheduleMeta, from, to);
      for (const day of days) {
        const dayStart = this.startOfDay(day);

        const exists = await this.prisma.taskInstance.findFirst({
          where: {
            companyId,
            templateId: template.id,
            generatedDate: dayStart
          },
          select: { id: true }
        });

        if (exists) continue;

        const created = await this.prisma.taskInstance.create({
          data: {
            companyId,
            templateId: template.id,
            boardId: template.boardId,
            title: template.title,
            description: template.description,
            priority: template.priority,
            dueDate: dayStart,
            status: 'OPEN',
            assigneeUserId: template.defaultAssigneeUserId,
            assigneeRoleId: template.defaultAssigneeRoleId,
            createdByUserId: actorUserId,
            generatedDate: dayStart
          }
        });

        generatedIds.push(created.id);
      }
    }

    await this.logCompany(
      actorUserId,
      companyId,
      'company.task.generate',
      'task_instance',
      undefined,
      { from: parsed.from, to: parsed.to, generatedCount: generatedIds.length },
      ip,
      userAgent
    );

    return {
      from: parsed.from,
      to: parsed.to,
      generatedCount: generatedIds.length,
      generatedIds
    };
  }

  async listComments(companyId: string, taskId: string) {
    await this.requireTask(companyId, taskId);
    return this.prisma.taskComment.findMany({
      where: { companyId, taskId },
      include: { authorUser: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async createComment(actorUserId: string, companyId: string, taskId: string, payload: unknown, ip?: string, userAgent?: string) {
    await this.requireTask(companyId, taskId);
    const body = taskCommentSchema.parse(payload);

    const row = await this.prisma.taskComment.create({
      data: {
        companyId,
        taskId,
        authorUserId: actorUserId,
        message: body.message
      },
      include: { authorUser: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.task.comment.create', 'task_comment', row.id, { taskId }, ip, userAgent);
    return row;
  }

  async summaryReport(companyId: string, query: unknown) {
    const parsed = taskGenerateQuerySchema.parse(query);
    const from = this.parseDateValue(parsed.from, false);
    const to = this.parseDateValue(parsed.to, true);

    const tasks = await this.prisma.taskInstance.findMany({
      where: {
        companyId,
        dueDate: { gte: from, lte: to }
      },
      include: { assigneeUser: true }
    });

    const done = tasks.filter((row) => row.status === 'DONE').length;
    const now = new Date();
    const overdue = tasks.filter((row) => row.status !== 'DONE' && row.dueDate < now).length;

    const byAssignee = new Map<string, { assignee: string; total: number; done: number; overdue: number }>();
    for (const row of tasks) {
      const key = row.assigneeUserId ?? row.assigneeRoleId ?? 'unassigned';
      const label = row.assigneeUser?.fullName ?? (row.assigneeRoleId ? `Role:${row.assigneeRoleId}` : 'Unassigned');
      const current = byAssignee.get(key) ?? { assignee: label, total: 0, done: 0, overdue: 0 };
      current.total += 1;
      if (row.status === 'DONE') current.done += 1;
      if (row.status !== 'DONE' && row.dueDate < now) current.overdue += 1;
      byAssignee.set(key, current);
    }

    return {
      from: parsed.from,
      to: parsed.to,
      total: tasks.length,
      done,
      overdue,
      completionRate: tasks.length === 0 ? 0 : (done / tasks.length) * 100,
      byAssignee: Array.from(byAssignee.values()).sort((a, b) => b.overdue - a.overdue || b.total - a.total)
    };
  }

  async overdueByAssignee(companyId: string) {
    const now = new Date();
    const tasks = await this.prisma.taskInstance.findMany({
      where: {
        companyId,
        dueDate: { lt: now },
        status: { not: 'DONE' }
      },
      include: { assigneeUser: true }
    });

    const byAssignee = new Map<string, { assignee: string; overdueCount: number }>();
    for (const row of tasks) {
      const key = row.assigneeUserId ?? row.assigneeRoleId ?? 'unassigned';
      const label = row.assigneeUser?.fullName ?? (row.assigneeRoleId ? `Role:${row.assigneeRoleId}` : 'Unassigned');
      const current = byAssignee.get(key) ?? { assignee: label, overdueCount: 0 };
      current.overdueCount += 1;
      byAssignee.set(key, current);
    }

    return {
      overdueTotal: tasks.length,
      byAssignee: Array.from(byAssignee.values()).sort((a, b) => b.overdueCount - a.overdueCount)
    };
  }

  private generateTemplateDates(scheduleType: TaskScheduleType, scheduleMeta: Prisma.JsonValue | null, from: Date, to: Date) {
    const output: Date[] = [];
    if (scheduleType === 'NONE') return output;

    let cursor = this.startOfDay(from);
    const end = this.startOfDay(to);

    while (cursor <= end) {
      const dayOfWeek = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
      const month = cursor.getUTCMonth() + 1;
      const dayOfMonth = cursor.getUTCDate();

      if (scheduleType === 'DAILY') {
        output.push(new Date(cursor));
      } else if (scheduleType === 'WEEKLY') {
        const days = this.readNumberArray(scheduleMeta, 'daysOfWeek');
        if (days.length === 0 || days.includes(dayOfWeek)) {
          output.push(new Date(cursor));
        }
      } else if (scheduleType === 'MONTHLY') {
        const day = this.readNumber(scheduleMeta, 'dayOfMonth') ?? 1;
        if (day === dayOfMonth) {
          output.push(new Date(cursor));
        }
      } else if (scheduleType === 'YEARLY') {
        const targetMonth = this.readNumber(scheduleMeta, 'month') ?? 1;
        const targetDay = this.readNumber(scheduleMeta, 'day') ?? 1;
        if (targetMonth === month && targetDay === dayOfMonth) {
          output.push(new Date(cursor));
        }
      }

      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
    }

    return output;
  }

  private readNumber(value: Prisma.JsonValue | null, key: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === 'number' ? raw : null;
  }

  private readNumberArray(value: Prisma.JsonValue | null, key: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const raw = (value as Record<string, unknown>)[key];
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is number => typeof item === 'number');
  }

  private async validateTemplateReferences(
    companyId: string,
    data: {
      boardId?: string | null;
      defaultAssigneeType?: 'USER' | 'ROLE';
      defaultAssigneeUserId?: string | null;
      defaultAssigneeRoleId?: string | null;
    }
  ) {
    if (data.boardId) {
      await this.requireBoard(companyId, data.boardId);
    }

    if (data.defaultAssigneeType === 'USER') {
      if (!data.defaultAssigneeUserId) {
        throw new BadRequestException('defaultAssigneeUserId is required when defaultAssigneeType is USER');
      }
      await this.requireCompanyUser(companyId, data.defaultAssigneeUserId);
      if (data.defaultAssigneeRoleId) {
        throw new BadRequestException('defaultAssigneeRoleId must be empty when defaultAssigneeType is USER');
      }
    }

    if (data.defaultAssigneeType === 'ROLE') {
      if (!data.defaultAssigneeRoleId) {
        throw new BadRequestException('defaultAssigneeRoleId is required when defaultAssigneeType is ROLE');
      }
      await this.requireCompanyRole(companyId, data.defaultAssigneeRoleId);
      if (data.defaultAssigneeUserId) {
        throw new BadRequestException('defaultAssigneeUserId must be empty when defaultAssigneeType is ROLE');
      }
    }
  }

  private async validateTaskReferences(
    companyId: string,
    data: {
      templateId?: string | null;
      boardId?: string | null;
      assigneeUserId?: string | null;
      assigneeRoleId?: string | null;
    }
  ) {
    if (data.templateId) {
      await this.requireTemplate(companyId, data.templateId);
    }
    if (data.boardId) {
      await this.requireBoard(companyId, data.boardId);
    }
    if (data.assigneeUserId) {
      await this.requireCompanyUser(companyId, data.assigneeUserId);
    }
    if (data.assigneeRoleId) {
      await this.requireCompanyRole(companyId, data.assigneeRoleId);
    }
  }

  private async requireBoard(companyId: string, id: string) {
    const row = await this.prisma.taskBoard.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Task board not found');
    }
    return row;
  }

  private async requireTemplate(companyId: string, id: string) {
    const row = await this.prisma.taskTemplate.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Task template not found');
    }
    return row;
  }

  private async requireTask(companyId: string, id: string) {
    const row = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        board: true,
        template: true,
        assigneeUser: true,
        assigneeRole: true,
        createdByUser: true
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Task not found');
    }
    return row;
  }

  private async requireCompanyRole(companyId: string, roleId: string) {
    const role = await this.prisma.companyRole.findUnique({ where: { id: roleId } });
    if (!role || role.companyId !== companyId) {
      throw new BadRequestException('Invalid assignee role for tenant');
    }
    return role;
  }

  private async requireCompanyUser(companyId: string, userId: string) {
    const membership = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } }
    });

    if (!membership || membership.status !== 'active') {
      throw new BadRequestException('Invalid assignee user for tenant');
    }

    return membership;
  }

  private startOfDay(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private parseDateValue(raw: string, endOfDay = false) {
    const dateText = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : raw;
    const value = new Date(dateText);
    if (Number.isNaN(value.valueOf())) {
      throw new BadRequestException('Invalid date value');
    }
    return value;
  }

  private async logCompany(
    actorUserId: string,
    companyId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata: Record<string, unknown> = {},
    ip?: string,
    userAgent?: string
  ) {
    const safe: JsonObject = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined) continue;
      safe[key] = value as Prisma.InputJsonValue | null;
    }

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action,
      entityType,
      entityId,
      metadata: safe,
      ip,
      userAgent
    });
  }
}
