import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type FinanceRecurringRule } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import {
  financeAccountSchema,
  financeCategorySchema,
  financeCounterpartySchema,
  financeEntrySchema,
  financeRecurringRuleSchema,
  financeReportRangeSchema
} from '@monocore/shared';

type EntryFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
  counterpartyId?: string;
  accountId?: string;
};

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

@Injectable()
export class FinanceService {
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

    const keys = new Set(membership.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)));
    return {
      permissions: Array.from(keys),
      manageCounterparty: keys.has('module:finance-core.counterparty.manage'),
      manageAccount: keys.has('module:finance-core.account.manage'),
      manageRecurring: keys.has('module:finance-core.recurring.manage'),
      readReports: keys.has('module:finance-core.reports.read'),
      createEntry: keys.has('module:finance-core.entry.create'),
      deleteEntry: keys.has('module:finance-core.entry.delete'),
      readEntry: keys.has('module:finance-core.entry.read')
    };
  }

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

    await this.logCompany(actorUserId, companyId, 'company.finance.category.create', 'finance_category', category.id, body, ip, userAgent);
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
    const existing = await this.requireCategory(companyId, categoryId);

    const category = await this.prisma.financeCategory.update({
      where: { id: existing.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.type ? { type: body.type } : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.category.update', 'finance_category', category.id, body, ip, userAgent);
    return category;
  }

  async deleteCategory(actorUserId: string, companyId: string, categoryId: string, ip?: string, userAgent?: string) {
    const existing = await this.requireCategory(companyId, categoryId);

    try {
      await this.prisma.financeCategory.delete({ where: { id: existing.id } });
    } catch {
      throw new BadRequestException('Category has linked finance entries or recurring rules');
    }

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.category.delete',
      'finance_category',
      existing.id,
      { name: existing.name, type: existing.type },
      ip,
      userAgent
    );

    return { success: true };
  }

  listCounterparties(companyId: string, type?: string) {
    return this.prisma.financeCounterparty.findMany({
      where: {
        companyId,
        ...(type ? { type: type as never } : {})
      },
      orderBy: [{ name: 'asc' }]
    });
  }

  async createCounterparty(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeCounterpartySchema.parse(payload);
    const counterparty = await this.prisma.financeCounterparty.create({
      data: {
        companyId,
        ...body
      }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.counterparty.create',
      'finance_counterparty',
      counterparty.id,
      body,
      ip,
      userAgent
    );

    return counterparty;
  }

  async updateCounterparty(
    actorUserId: string,
    companyId: string,
    id: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financeCounterpartySchema.partial().parse(payload);
    const row = await this.requireCounterparty(companyId, id);

    const updated = await this.prisma.financeCounterparty.update({
      where: { id: row.id },
      data: body
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.counterparty.update',
      'finance_counterparty',
      updated.id,
      body,
      ip,
      userAgent
    );

    return updated;
  }

  async deleteCounterparty(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const row = await this.requireCounterparty(companyId, id);

    try {
      await this.prisma.financeCounterparty.delete({ where: { id: row.id } });
    } catch {
      throw new BadRequestException('Counterparty has linked entries or recurring rules');
    }

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.counterparty.delete',
      'finance_counterparty',
      row.id,
      { name: row.name, type: row.type },
      ip,
      userAgent
    );

    return { success: true };
  }

  listAccounts(companyId: string) {
    return this.prisma.financeAccount.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
  }

  async createAccount(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeAccountSchema.parse(payload);
    const account = await this.prisma.financeAccount.create({
      data: {
        companyId,
        type: body.type,
        name: body.name,
        currency: body.currency,
        isActive: body.isActive ?? true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.account.create', 'finance_account', account.id, body, ip, userAgent);
    return account;
  }

  async updateAccount(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeAccountSchema.partial().parse(payload);
    const row = await this.requireAccount(companyId, id);

    const updated = await this.prisma.financeAccount.update({
      where: { id: row.id },
      data: {
        ...(body.type ? { type: body.type } : {}),
        ...(body.name ? { name: body.name } : {}),
        ...(body.currency ? { currency: body.currency } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.account.update', 'finance_account', updated.id, body, ip, userAgent);
    return updated;
  }

  async deactivateAccount(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const row = await this.requireAccount(companyId, id);
    const updated = await this.prisma.financeAccount.update({
      where: { id: row.id },
      data: { isActive: false }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.account.deactivate',
      'finance_account',
      updated.id,
      { previousActive: row.isActive },
      ip,
      userAgent
    );

    return updated;
  }

  async listEntries(companyId: string, filters: EntryFilters) {
    const where: Prisma.FinanceEntryWhereInput = {
      companyId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.counterpartyId ? { counterpartyId: filters.counterpartyId } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: this.parseDateValue(filters.from, false) } : {}),
              ...(filters.to ? { lte: this.parseDateValue(filters.to, true) } : {})
            }
          }
        : {})
    };

    return this.prisma.financeEntry.findMany({
      where,
      include: { category: true, counterparty: true, account: true, recurringRule: true, createdByUser: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createEntry(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeEntrySchema.parse(payload);
    await this.assertEntryReferencesBelongToCompany(companyId, body);

    const entry = await this.prisma.financeEntry.create({
      data: {
        companyId,
        categoryId: body.categoryId,
        counterpartyId: body.counterpartyId ?? null,
        accountId: body.accountId ?? null,
        reference: body.reference ?? null,
        amount: new Prisma.Decimal(body.amount),
        date: this.parseDateValue(body.date),
        description: body.description,
        createdByUserId: actorUserId
      },
      include: { category: true, counterparty: true, account: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.entry.create',
      'finance_entry',
      entry.id,
      {
        categoryId: body.categoryId,
        counterpartyId: body.counterpartyId ?? null,
        accountId: body.accountId ?? null,
        reference: body.reference ?? null,
        amount: body.amount,
        date: body.date,
        description: body.description ?? null
      },
      ip,
      userAgent
    );

    return entry;
  }

  async updateEntry(actorUserId: string, companyId: string, entryId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeEntrySchema.partial().parse(payload);
    const existing = await this.prisma.financeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException('Entry not found');
    }

    await this.assertEntryReferencesBelongToCompany(companyId, body);

    const entry = await this.prisma.financeEntry.update({
      where: { id: entryId },
      data: {
        ...(body.categoryId ? { categoryId: body.categoryId } : {}),
        ...(body.counterpartyId !== undefined ? { counterpartyId: body.counterpartyId } : {}),
        ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
        ...(body.reference !== undefined ? { reference: body.reference } : {}),
        ...(body.amount !== undefined ? { amount: new Prisma.Decimal(body.amount) } : {}),
        ...(body.date ? { date: this.parseDateValue(body.date) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {})
      },
      include: { category: true, counterparty: true, account: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.entry.update',
      'finance_entry',
      entry.id,
      {
        categoryId: body.categoryId ?? entry.categoryId,
        counterpartyId: body.counterpartyId ?? entry.counterpartyId,
        accountId: body.accountId ?? entry.accountId,
        reference: body.reference ?? entry.reference,
        amount: body.amount ?? Number(entry.amount),
        date: body.date ?? entry.date.toISOString(),
        description: body.description ?? entry.description
      },
      ip,
      userAgent
    );

    return entry;
  }

  async deleteEntry(actorUserId: string, companyId: string, entryId: string, ip?: string, userAgent?: string) {
    const existing = await this.prisma.financeEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException('Entry not found');
    }

    await this.prisma.financeEntry.delete({ where: { id: entryId } });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.entry.delete',
      'finance_entry',
      entryId,
      {
        categoryId: existing.categoryId,
        counterpartyId: existing.counterpartyId,
        accountId: existing.accountId,
        reference: existing.reference,
        amount: Number(existing.amount),
        date: existing.date.toISOString()
      },
      ip,
      userAgent
    );

    return { success: true };
  }

  listRecurringRules(companyId: string) {
    return this.prisma.financeRecurringRule.findMany({
      where: { companyId },
      include: { category: true, counterparty: true, account: true },
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }]
    });
  }

  async createRecurringRule(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeRecurringRuleSchema.parse(payload);
    await this.assertRecurringReferencesBelongToCompany(companyId, body);

    const rule = await this.prisma.financeRecurringRule.create({
      data: {
        companyId,
        name: body.name,
        direction: body.direction,
        categoryId: body.categoryId,
        amount: new Prisma.Decimal(body.amount),
        startDate: this.parseDateValue(body.startDate),
        frequency: body.frequency,
        dayOfMonth: body.dayOfMonth ?? null,
        nextRunAt: this.parseDateValue(body.nextRunAt),
        isActive: body.isActive ?? true,
        counterpartyId: body.counterpartyId ?? null,
        accountId: body.accountId ?? null,
        createdByUserId: actorUserId
      },
      include: { category: true, counterparty: true, account: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.recurring.create', 'finance_recurring_rule', rule.id, body, ip, userAgent);
    return rule;
  }

  async updateRecurringRule(
    actorUserId: string,
    companyId: string,
    ruleId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financeRecurringRuleSchema.partial().parse(payload);
    const existing = await this.requireRecurringRule(companyId, ruleId);
    await this.assertRecurringReferencesBelongToCompany(companyId, body);

    const rule = await this.prisma.financeRecurringRule.update({
      where: { id: existing.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.direction ? { direction: body.direction } : {}),
        ...(body.categoryId ? { categoryId: body.categoryId } : {}),
        ...(body.amount !== undefined ? { amount: new Prisma.Decimal(body.amount) } : {}),
        ...(body.startDate ? { startDate: this.parseDateValue(body.startDate) } : {}),
        ...(body.frequency ? { frequency: body.frequency } : {}),
        ...(body.dayOfMonth !== undefined ? { dayOfMonth: body.dayOfMonth } : {}),
        ...(body.nextRunAt ? { nextRunAt: this.parseDateValue(body.nextRunAt) } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.counterpartyId !== undefined ? { counterpartyId: body.counterpartyId } : {}),
        ...(body.accountId !== undefined ? { accountId: body.accountId } : {})
      },
      include: { category: true, counterparty: true, account: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.recurring.update', 'finance_recurring_rule', rule.id, body, ip, userAgent);
    return rule;
  }

  async runRecurringNow(actorUserId: string, companyId: string, ruleId: string, ip?: string, userAgent?: string) {
    const rule = await this.requireRecurringRule(companyId, ruleId);
    const result = await this.generateEntryFromRule(actorUserId, companyId, rule);

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.recurring.run_now',
      'finance_recurring_rule',
      rule.id,
      { generatedEntryId: result.entry.id, nextRunAt: result.nextRunAt.toISOString() },
      ip,
      userAgent
    );

    return result;
  }

  async runDueRecurring(actorUserId: string, companyId: string, ip?: string, userAgent?: string) {
    const now = new Date();
    const rules = await this.prisma.financeRecurringRule.findMany({
      where: {
        companyId,
        isActive: true,
        nextRunAt: { lte: now }
      }
    });

    const generated: Array<{ ruleId: string; entryId: string; nextRunAt: string }> = [];
    for (const rule of rules) {
      const result = await this.generateEntryFromRule(actorUserId, companyId, rule);
      generated.push({ ruleId: rule.id, entryId: result.entry.id, nextRunAt: result.nextRunAt.toISOString() });
    }

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.recurring.run_due',
      'finance_recurring_rule',
      undefined,
      { count: generated.length, generated },
      ip,
      userAgent
    );

    return { count: generated.length, generated };
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

  async pnlReport(companyId: string, query: unknown) {
    const parsed = financeReportRangeSchema.parse(query);
    const range = this.reportRange(parsed.from, parsed.to);

    const entries = await this.prisma.financeEntry.findMany({
      where: {
        companyId,
        date: {
          gte: range.from,
          lte: range.to
        }
      },
      include: { category: true }
    });

    const byCategory = new Map<string, { categoryId: string; categoryName: string; type: string; total: number }>();
    let income = 0;
    let expense = 0;

    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (entry.category.type === 'INCOME') {
        income += amount;
      } else {
        expense += amount;
      }

      const key = entry.category.id;
      const current = byCategory.get(key) ?? {
        categoryId: entry.category.id,
        categoryName: entry.category.name,
        type: entry.category.type,
        total: 0
      };
      current.total += amount;
      byCategory.set(key, current);
    }

    return {
      from: parsed.from,
      to: parsed.to,
      totals: {
        income,
        expense,
        net: income - expense
      },
      byCategory: Array.from(byCategory.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
    };
  }

  async cashflowReport(companyId: string, query: unknown) {
    const parsed = financeReportRangeSchema.parse(query);
    const range = this.reportRange(parsed.from, parsed.to);

    if (parsed.accountId) {
      await this.requireAccount(companyId, parsed.accountId);
    }

    const entries = await this.prisma.financeEntry.findMany({
      where: {
        companyId,
        date: {
          gte: range.from,
          lte: range.to
        },
        ...(parsed.accountId ? { accountId: parsed.accountId } : {})
      },
      include: { account: true, category: true }
    });

    const grouped = new Map<string, { accountId: string | null; accountName: string; income: number; expense: number; net: number }>();

    for (const entry of entries) {
      const key = entry.accountId ?? 'unassigned';
      const current = grouped.get(key) ?? {
        accountId: entry.accountId,
        accountName: entry.account?.name ?? 'Unassigned',
        income: 0,
        expense: 0,
        net: 0
      };

      const amount = Number(entry.amount);
      if (entry.category.type === 'INCOME') {
        current.income += amount;
      } else {
        current.expense += amount;
      }
      current.net = current.income - current.expense;

      grouped.set(key, current);
    }

    return {
      from: parsed.from,
      to: parsed.to,
      accountId: parsed.accountId ?? null,
      groupedByAccount: Array.from(grouped.values()).sort((a, b) => a.accountName.localeCompare(b.accountName))
    };
  }

  private async generateEntryFromRule(actorUserId: string, companyId: string, rule: FinanceRecurringRule) {
    const runAt = new Date();
    const nextRunAt = this.computeNextRunAt(rule.nextRunAt, rule.frequency, rule.dayOfMonth ?? undefined);

    const [entry] = await this.prisma.$transaction([
      this.prisma.financeEntry.create({
        data: {
          companyId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          date: runAt,
          description: `Recurring: ${rule.name}`,
          createdByUserId: actorUserId,
          counterpartyId: rule.counterpartyId,
          accountId: rule.accountId,
          reference: null,
          isRecurringGenerated: true,
          recurringRuleId: rule.id
        }
      }),
      this.prisma.financeRecurringRule.update({
        where: { id: rule.id },
        data: { nextRunAt }
      })
    ]);

    return { entry, nextRunAt };
  }

  private computeNextRunAt(current: Date, frequency: 'WEEKLY' | 'MONTHLY', dayOfMonth?: number) {
    const base = new Date(current);

    if (frequency === 'WEEKLY') {
      base.setUTCDate(base.getUTCDate() + 7);
      return base;
    }

    const dom = dayOfMonth ?? base.getUTCDate();
    base.setUTCMonth(base.getUTCMonth() + 1);
    const daysInMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(dom, daysInMonth));
    return base;
  }

  private parseDateValue(raw: string, endOfDay = false) {
    const dateText = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : raw;
    const value = new Date(dateText);
    if (Number.isNaN(value.valueOf())) {
      throw new BadRequestException('Invalid date value');
    }
    return value;
  }

  private reportRange(from: string, to: string) {
    const fromDate = this.parseDateValue(from);
    const toDate = this.parseDateValue(to, true);
    if (fromDate > toDate) {
      throw new BadRequestException('Invalid date range');
    }
    return { from: fromDate, to: toDate };
  }

  private async assertEntryReferencesBelongToCompany(
    companyId: string,
    body: {
      categoryId?: string;
      counterpartyId?: string | null;
      accountId?: string | null;
      recurringRuleId?: string | null;
    }
  ) {
    if (body.categoryId) {
      await this.requireCategory(companyId, body.categoryId);
    }
    if (body.counterpartyId) {
      await this.requireCounterparty(companyId, body.counterpartyId);
    }
    if (body.accountId) {
      await this.requireAccount(companyId, body.accountId);
    }
    if (body.recurringRuleId) {
      await this.requireRecurringRule(companyId, body.recurringRuleId);
    }
  }

  private async assertRecurringReferencesBelongToCompany(
    companyId: string,
    body: {
      categoryId?: string;
      counterpartyId?: string | null;
      accountId?: string | null;
    }
  ) {
    if (body.categoryId) {
      await this.requireCategory(companyId, body.categoryId);
    }
    if (body.counterpartyId) {
      await this.requireCounterparty(companyId, body.counterpartyId);
    }
    if (body.accountId) {
      await this.requireAccount(companyId, body.accountId);
    }
  }

  private async requireCategory(companyId: string, categoryId: string) {
    const category = await this.prisma.financeCategory.findUnique({ where: { id: categoryId } });
    if (!category || category.companyId !== companyId) {
      throw new ForbiddenException('Category is not owned by tenant');
    }
    return category;
  }

  private async requireCounterparty(companyId: string, id: string) {
    const row = await this.prisma.financeCounterparty.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Counterparty not found');
    }
    return row;
  }

  private async requireAccount(companyId: string, id: string) {
    const row = await this.prisma.financeAccount.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Account not found');
    }
    return row;
  }

  private async requireRecurringRule(companyId: string, id: string) {
    const row = await this.prisma.financeRecurringRule.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Recurring rule not found');
    }
    return row;
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
