import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import { financeCategorySchema, financeEntrySchema } from '@monocore/shared';

@Injectable()
export class FinanceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  listCategories(companyId: string) {
    return this.prisma.financeCategory.findMany({
      where: { companyId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });
  }

  async createCategory(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeCategorySchema.parse(payload);
    const category = await this.prisma.financeCategory.create({
      data: {
        companyId,
        name: body.name,
        type: body.type
      }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.finance.category.create',
      entityType: 'finance_category',
      entityId: category.id,
      metadata: body,
      ip,
      userAgent
    });

    return category;
  }

  async updateCategory(
    actorUserId: string,
    companyId: string,
    categoryId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financeCategorySchema.partial().parse(payload);
    const existing = await this.prisma.financeCategory.findUnique({ where: { id: categoryId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException('Category not found');
    }

    const category = await this.prisma.financeCategory.update({
      where: { id: categoryId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.type ? { type: body.type } : {})
      }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.finance.category.update',
      entityType: 'finance_category',
      entityId: category.id,
      metadata: body,
      ip,
      userAgent
    });

    return category;
  }

  async deleteCategory(actorUserId: string, companyId: string, categoryId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.financeCategory.findUnique({ where: { id: categoryId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException('Category not found');
    }

    try {
      await this.prisma.financeCategory.delete({ where: { id: categoryId } });
    } catch {
      throw new BadRequestException('Category has linked finance entries');
    }

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.finance.category.delete',
      entityType: 'finance_category',
      entityId: categoryId,
      metadata: { name: existing.name, type: existing.type },
      ip,
      userAgent
    });

    return { success: true };
  }

  listEntries(companyId: string) {
    return this.prisma.financeEntry.findMany({
      where: { companyId },
      include: { category: true, createdByUser: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createEntry(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeEntrySchema.parse(payload);
    const category = await this.prisma.financeCategory.findUnique({ where: { id: body.categoryId } });
    if (!category || category.companyId !== companyId) {
      throw new ForbiddenException('Category is not owned by tenant');
    }

    const entry = await this.prisma.financeEntry.create({
      data: {
        companyId,
        categoryId: body.categoryId,
        amount: new Prisma.Decimal(body.amount),
        date: new Date(body.date),
        description: body.description,
        createdByUserId: actorUserId
      },
      include: { category: true }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.finance.entry.create',
      entityType: 'finance_entry',
      entityId: entry.id,
      metadata: {
        categoryId: body.categoryId,
        amount: body.amount,
        date: body.date,
        description: body.description ?? null
      },
      ip,
      userAgent
    });

    return entry;
  }

  async updateEntry(actorUserId: string, companyId: string, entryId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeEntrySchema.partial().parse(payload);
    const existing = await this.prisma.financeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException('Entry not found');
    }

    if (body.categoryId) {
      const category = await this.prisma.financeCategory.findUnique({ where: { id: body.categoryId } });
      if (!category || category.companyId !== companyId) {
        throw new ForbiddenException('Category is not owned by tenant');
      }
    }

    const entry = await this.prisma.financeEntry.update({
      where: { id: entryId },
      data: {
        ...(body.categoryId ? { categoryId: body.categoryId } : {}),
        ...(body.amount !== undefined ? { amount: new Prisma.Decimal(body.amount) } : {}),
        ...(body.date ? { date: new Date(body.date) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {})
      },
      include: { category: true }
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.finance.entry.update',
      entityType: 'finance_entry',
      entityId: entry.id,
      metadata: body,
      ip,
      userAgent
    });

    return entry;
  }

  async deleteEntry(actorUserId: string, companyId: string, entryId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.financeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException('Entry not found');
    }

    await this.prisma.financeEntry.delete({ where: { id: entryId } });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.finance.entry.delete',
      entityType: 'finance_entry',
      entityId: entryId,
      metadata: {},
      ip,
      userAgent
    });

    return { success: true };
  }

  async monthlyPnl(companyId: string) {
    const entries = await this.prisma.financeEntry.findMany({
      where: { companyId },
      include: { category: true },
      orderBy: { date: 'asc' }
    });

    const buckets = new Map<string, { month: string; income: number; expense: number; net: number }>();

    for (const entry of entries) {
      const month = entry.date.toISOString().slice(0, 7);
      const current = buckets.get(month) ?? { month, income: 0, expense: 0, net: 0 };
      const amount = Number(entry.amount);

      if (entry.category.type === 'INCOME') {
        current.income += amount;
      } else {
        current.expense += amount;
      }

      current.net = current.income - current.expense;
      buckets.set(month, current);
    }

    return Array.from(buckets.values());
  }
}
