import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type FinanceRecurringRule } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';
import {
  financeAgingQuerySchema,
  financeAllocationRuleSchema,
  financeApplyAllocationSchema,
  financeAccountSchema,
  financeBudgetLinesBulkSchema,
  financeBudgetSchema,
  financeBudgetVsActualQuerySchema,
  financeCashflowForecastItemSchema,
  financeCashflowProjectionQuerySchema,
  financeCounterpartyBalanceQuerySchema,
  financeCategorySchema,
  financeCounterpartySchema,
  financeInvoiceQuerySchema,
  financeInvoiceSchema,
  financePaymentAllocateSchema,
  financePaymentQuerySchema,
  financePaymentSchema,
  financeEntrySchema,
  financeProfitCenterReportSchema,
  financeProfitCenterSchema,
  financeRecurringRuleSchema,
  financeReportRangeSchema
} from '@monocore/shared';

type EntryFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
  counterpartyId?: string;
  accountId?: string;
  profitCenterId?: string;
};

type InvoiceFilters = {
  direction?: 'PAYABLE' | 'RECEIVABLE';
  status?: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  from?: string;
  to?: string;
  counterpartyId?: string;
};

type PaymentFilters = {
  direction?: 'OUTGOING' | 'INCOMING';
  from?: string;
  to?: string;
  counterpartyId?: string;
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
      manageProfitCenter: keys.has('module:finance-core.profit-center.manage'),
      readProfitCenter: keys.has('module:finance-core.profit-center.read'),
      readProfitCenterReports: keys.has('module:finance-core.reports.profit-center.read'),
      readReports: keys.has('module:finance-core.reports.read'),
      manageAllocation: keys.has('module:finance-core.allocation.manage'),
      applyAllocation: keys.has('module:finance-core.allocation.apply'),
      readAllocation: keys.has('module:finance-core.allocation.read'),
      manageInvoice: keys.has('module:finance-core.invoice.manage'),
      readInvoice: keys.has('module:finance-core.invoice.read'),
      managePayment: keys.has('module:finance-core.payment.manage'),
      readPayment: keys.has('module:finance-core.payment.read'),
      readAgingReport: keys.has('module:finance-core.reports.aging.read'),
      manageBudget: keys.has('module:finance-core.budget.manage'),
      readBudget: keys.has('module:finance-core.budget.read'),
      readBudgetReports: keys.has('module:finance-core.reports.budget.read'),
      readCashflowProjection: keys.has('module:finance-core.reports.cashflow.read'),
      manageCashflowForecast: keys.has('module:finance-core.cashflow-forecast.manage'),
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

  listProfitCenters(companyId: string, active?: boolean) {
    return this.prisma.financeProfitCenter.findMany({
      where: {
        companyId,
        ...(active === undefined ? {} : { isActive: active })
      },
      include: {
        _count: { select: { entries: true } }
      },
      orderBy: [{ name: 'asc' }]
    });
  }

  async createProfitCenter(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeProfitCenterSchema.parse(payload);
    if (body.parentId) {
      await this.requireProfitCenter(companyId, body.parentId);
    }

    const center = await this.prisma.financeProfitCenter.create({
      data: {
        companyId,
        name: body.name,
        code: body.code ?? null,
        type: body.type,
        parentId: body.parentId ?? null,
        isActive: body.isActive ?? true
      },
      include: {
        _count: { select: { entries: true } }
      }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.profit_center.create',
      'finance_profit_center',
      center.id,
      body,
      ip,
      userAgent
    );

    return center;
  }

  async updateProfitCenter(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeProfitCenterSchema.partial().parse(payload);
    const center = await this.requireProfitCenter(companyId, id);

    if (body.parentId) {
      if (body.parentId === id) {
        throw new BadRequestException('parentId cannot be self');
      }
      await this.requireProfitCenter(companyId, body.parentId);
      await this.assertNoProfitCenterCycle(companyId, id, body.parentId);
    }

    const updated = await this.prisma.financeProfitCenter.update({
      where: { id: center.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      },
      include: {
        _count: { select: { entries: true } }
      }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.profit_center.update',
      'finance_profit_center',
      updated.id,
      body,
      ip,
      userAgent
    );

    return updated;
  }

  async deactivateProfitCenter(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const center = await this.requireProfitCenter(companyId, id);
    const updated = await this.prisma.financeProfitCenter.update({
      where: { id: center.id },
      data: { isActive: false }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.profit_center.deactivate',
      'finance_profit_center',
      updated.id,
      { previousActive: center.isActive },
      ip,
      userAgent
    );

    return updated;
  }

  listAllocationRules(companyId: string) {
    return this.prisma.financeAllocationRule.findMany({
      where: { companyId },
      include: {
        sourceCategory: true,
        sourceEntry: { include: { category: true } },
        targets: { include: { profitCenter: true }, orderBy: { createdAt: 'asc' } }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
  }

  async createAllocationRule(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeAllocationRuleSchema.parse(payload);
    this.assertAllocationRuleSources(body.sourceCategoryId, body.sourceEntryId);
    await this.validateAllocationTargets(companyId, body.targets);
    this.assertAllocationTotal(body.targets);

    if (body.sourceCategoryId) {
      await this.requireCategory(companyId, body.sourceCategoryId);
    }
    if (body.sourceEntryId) {
      const sourceEntry = await this.requireEntry(companyId, body.sourceEntryId);
      if (sourceEntry.category.type !== 'EXPENSE') {
        throw new BadRequestException('Allocation source entry must be expense');
      }
    }

    const created = await this.prisma.financeAllocationRule.create({
      data: {
        companyId,
        name: body.name,
        sourceCategoryId: body.sourceCategoryId ?? null,
        sourceEntryId: body.sourceEntryId ?? null,
        allocationMethod: body.allocationMethod,
        isActive: body.isActive ?? true,
        targets: {
          create: body.targets.map((target) => ({
            profitCenterId: target.profitCenterId,
            percentage: new Prisma.Decimal(target.percentage)
          }))
        }
      },
      include: {
        sourceCategory: true,
        sourceEntry: { include: { category: true } },
        targets: { include: { profitCenter: true }, orderBy: { createdAt: 'asc' } }
      }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.allocation_rule.create',
      'finance_allocation_rule',
      created.id,
      {
        name: created.name,
        sourceCategoryId: created.sourceCategoryId,
        sourceEntryId: created.sourceEntryId,
        allocationMethod: created.allocationMethod,
        targets: created.targets.map((target) => ({
          profitCenterId: target.profitCenterId,
          percentage: Number(target.percentage)
        }))
      },
      ip,
      userAgent
    );

    return created;
  }

  async updateAllocationRule(
    actorUserId: string,
    companyId: string,
    ruleId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financeAllocationRuleSchema.partial().parse(payload);
    const existing = await this.requireAllocationRule(companyId, ruleId);

    const sourceCategoryId = body.sourceCategoryId === undefined ? existing.sourceCategoryId : body.sourceCategoryId;
    const sourceEntryId = body.sourceEntryId === undefined ? existing.sourceEntryId : body.sourceEntryId;
    this.assertAllocationRuleSources(sourceCategoryId, sourceEntryId);

    if (sourceCategoryId) {
      await this.requireCategory(companyId, sourceCategoryId);
    }
    if (sourceEntryId) {
      const sourceEntry = await this.requireEntry(companyId, sourceEntryId);
      if (sourceEntry.category.type !== 'EXPENSE') {
        throw new BadRequestException('Allocation source entry must be expense');
      }
    }

    if (body.targets) {
      await this.validateAllocationTargets(companyId, body.targets);
      this.assertAllocationTotal(body.targets);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (body.targets) {
        await tx.financeAllocationTarget.deleteMany({ where: { allocationRuleId: existing.id } });
      }

      return tx.financeAllocationRule.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.sourceCategoryId !== undefined ? { sourceCategoryId: body.sourceCategoryId } : {}),
          ...(body.sourceEntryId !== undefined ? { sourceEntryId: body.sourceEntryId } : {}),
          ...(body.allocationMethod !== undefined ? { allocationMethod: body.allocationMethod } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.targets
            ? {
                targets: {
                  create: body.targets.map((target) => ({
                    profitCenterId: target.profitCenterId,
                    percentage: new Prisma.Decimal(target.percentage)
                  }))
                }
              }
            : {})
        },
        include: {
          sourceCategory: true,
          sourceEntry: { include: { category: true } },
          targets: { include: { profitCenter: true }, orderBy: { createdAt: 'asc' } }
        }
      });
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.allocation_rule.update',
      'finance_allocation_rule',
      updated.id,
      {
        name: updated.name,
        sourceCategoryId: updated.sourceCategoryId,
        sourceEntryId: updated.sourceEntryId,
        allocationMethod: updated.allocationMethod,
        isActive: updated.isActive,
        targets: updated.targets.map((target) => ({
          profitCenterId: target.profitCenterId,
          percentage: Number(target.percentage)
        }))
      },
      ip,
      userAgent
    );

    return updated;
  }

  async applyAllocationRule(
    actorUserId: string,
    companyId: string,
    ruleId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financeApplyAllocationSchema.parse(payload);
    const rule = await this.prisma.financeAllocationRule.findUnique({
      where: { id: ruleId },
      include: { targets: true }
    });

    if (!rule || rule.companyId !== companyId) {
      throw new NotFoundException('Allocation rule not found');
    }
    if (!rule.isActive) {
      throw new BadRequestException('Allocation rule is inactive');
    }
    if (!rule.targets.length) {
      throw new BadRequestException('Allocation rule has no targets');
    }

    this.assertAllocationTotal(
      rule.targets.map((target) => ({ profitCenterId: target.profitCenterId, percentage: Number(target.percentage) }))
    );

    const sourceEntry = await this.requireEntry(companyId, body.sourceEntryId);
    if (sourceEntry.category.type !== 'EXPENSE') {
      throw new BadRequestException('Only expense entries can be allocated');
    }
    if (sourceEntry.isAllocationGenerated) {
      throw new BadRequestException('Generated allocation entries cannot be re-allocated');
    }

    if (rule.sourceEntryId && rule.sourceEntryId !== sourceEntry.id) {
      throw new BadRequestException('This rule can only be applied to its configured source entry');
    }
    if (rule.sourceCategoryId && rule.sourceCategoryId !== sourceEntry.categoryId) {
      throw new BadRequestException('Source entry category does not match allocation rule category');
    }

    const alreadyAllocated = await this.prisma.financeAllocationBatch.findFirst({
      where: { companyId, sourceEntryId: sourceEntry.id },
      select: { id: true }
    });
    if (alreadyAllocated) {
      throw new BadRequestException('This source entry is already allocated');
    }

    const generated = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.financeAllocationBatch.create({
        data: {
          companyId,
          allocationRuleId: rule.id,
          sourceEntryId: sourceEntry.id,
          createdByUserId: actorUserId
        }
      });

      const sourceAmount = Number(sourceEntry.amount);
      const normalizedTargets = rule.targets.map((target) => ({
        profitCenterId: target.profitCenterId,
        percentage: Number(target.percentage)
      }));

      const data = normalizedTargets.map((target, index) => {
        const raw = (sourceAmount * target.percentage) / 100;
        const rounded = index === normalizedTargets.length - 1 ? 0 : Math.round(raw * 100) / 100;
        return { ...target, amount: rounded };
      });

      const totalWithoutLast = data.slice(0, -1).reduce((sum, row) => sum + row.amount, 0);
      if (data.length) {
        data[data.length - 1].amount = Math.round((sourceAmount - totalWithoutLast) * 100) / 100;
      }

      const entries = [];
      for (const row of data) {
        const createdEntry = await tx.financeEntry.create({
          data: {
            companyId,
            categoryId: sourceEntry.categoryId,
            counterpartyId: sourceEntry.counterpartyId,
            accountId: sourceEntry.accountId,
            profitCenterId: row.profitCenterId,
            reference: sourceEntry.reference,
            amount: new Prisma.Decimal(row.amount.toFixed(2)),
            date: sourceEntry.date,
            description: sourceEntry.description ? `[Allocated] ${sourceEntry.description}` : 'Allocated expense',
            createdByUserId: actorUserId,
            allocationBatchId: batch.id,
            isAllocationGenerated: true
          },
          include: { category: true, counterparty: true, account: true, profitCenter: true }
        });
        entries.push(createdEntry);
      }

      return { batch, entries };
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.allocation_rule.apply',
      'finance_allocation_batch',
      generated.batch.id,
      {
        context: {
          allocationRuleId: rule.id,
          sourceEntryId: sourceEntry.id
        },
        counts: {
          generatedEntriesCount: generated.entries.length
        },
        ids: {
          generatedEntryIds: generated.entries.map((entry) => entry.id)
        },
        totals: {
          sourceAmount: Number(sourceEntry.amount)
        }
      },
      ip,
      userAgent
    );

    return {
      batch: generated.batch,
      generatedEntries: generated.entries
    };
  }

  listAllocationBatches(companyId: string) {
    return this.prisma.financeAllocationBatch.findMany({
      where: { companyId },
      include: {
        allocationRule: true,
        sourceEntry: { include: { category: true } },
        generatedEntries: { include: { profitCenter: true, category: true }, orderBy: { createdAt: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async listInvoices(companyId: string, query: unknown) {
    const parsed = financeInvoiceQuerySchema.parse(query) as InvoiceFilters;
    return this.prisma.financeInvoice.findMany({
      where: {
        companyId,
        ...(parsed.direction ? { direction: parsed.direction } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.counterpartyId ? { counterpartyId: parsed.counterpartyId } : {}),
        ...(parsed.from || parsed.to
          ? {
              issueDate: {
                ...(parsed.from ? { gte: this.parseDateValue(parsed.from, false) } : {}),
                ...(parsed.to ? { lte: this.parseDateValue(parsed.to, true) } : {})
              }
            }
          : {})
      },
      include: {
        counterparty: true,
        lines: true,
        paymentAllocations: true
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createInvoice(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeInvoiceSchema.parse(payload);
    await this.requireCounterparty(companyId, body.counterpartyId);
    const totals = this.computeInvoiceTotals(body.lines);

    const created = await this.prisma.financeInvoice.create({
      data: {
        companyId,
        direction: body.direction,
        counterpartyId: body.counterpartyId,
        invoiceNo: body.invoiceNo,
        issueDate: this.parseDateValue(body.issueDate),
        dueDate: this.parseDateValue(body.dueDate),
        currency: body.currency,
        status: body.status ?? 'ISSUED',
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        notes: body.notes ?? null,
        createdByUserId: actorUserId,
        lines: {
          create: body.lines.map((line) => ({
            description: line.description,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            taxRate: line.taxRate === null || line.taxRate === undefined ? null : new Prisma.Decimal(line.taxRate),
            lineTotal: this.computeLineTotal(line.quantity, line.unitPrice, line.taxRate ?? null)
          }))
        }
      },
      include: { counterparty: true, lines: true, paymentAllocations: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.invoice.create',
      'finance_invoice',
      created.id,
      { direction: created.direction, counterpartyId: created.counterpartyId, invoiceNo: created.invoiceNo, total: Number(created.total) },
      ip,
      userAgent
    );

    return created;
  }

  async getInvoice(companyId: string, invoiceId: string) {
    return this.requireInvoice(companyId, invoiceId);
  }

  async updateInvoice(
    actorUserId: string,
    companyId: string,
    invoiceId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financeInvoiceSchema.partial().parse(payload);
    const existing = await this.requireInvoice(companyId, invoiceId);
    if (existing.status === 'VOID') {
      throw new BadRequestException('Cannot update void invoice');
    }

    if (body.counterpartyId) {
      await this.requireCounterparty(companyId, body.counterpartyId);
    }

    const hasLines = body.lines !== undefined;
    const totals = hasLines ? this.computeInvoiceTotals(body.lines as Array<{ quantity: number; unitPrice: number; taxRate?: number | null }>) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (hasLines) {
        await tx.financeInvoiceLine.deleteMany({ where: { invoiceId: existing.id } });
      }

      const invoice = await tx.financeInvoice.update({
        where: { id: existing.id },
        data: {
          ...(body.direction ? { direction: body.direction } : {}),
          ...(body.counterpartyId ? { counterpartyId: body.counterpartyId } : {}),
          ...(body.invoiceNo ? { invoiceNo: body.invoiceNo } : {}),
          ...(body.issueDate ? { issueDate: this.parseDateValue(body.issueDate) } : {}),
          ...(body.dueDate ? { dueDate: this.parseDateValue(body.dueDate) } : {}),
          ...(body.currency ? { currency: body.currency } : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(totals ? { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total } : {}),
          ...(hasLines
            ? {
                lines: {
                  create: (body.lines as Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number | null }>).map(
                    (line) => ({
                      description: line.description,
                      quantity: new Prisma.Decimal(line.quantity),
                      unitPrice: new Prisma.Decimal(line.unitPrice),
                      taxRate: line.taxRate === null || line.taxRate === undefined ? null : new Prisma.Decimal(line.taxRate),
                      lineTotal: this.computeLineTotal(line.quantity, line.unitPrice, line.taxRate ?? null)
                    })
                  )
                }
              }
            : {})
        },
        include: { counterparty: true, lines: true, paymentAllocations: true }
      });

      await this.recalculateInvoiceStatus(tx, invoice.id);
      return tx.financeInvoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { counterparty: true, lines: true, paymentAllocations: true }
      });
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.invoice.update',
      'finance_invoice',
      updated.id,
      { direction: updated.direction, counterpartyId: updated.counterpartyId, invoiceNo: updated.invoiceNo, total: Number(updated.total) },
      ip,
      userAgent
    );

    return updated;
  }

  async voidInvoice(actorUserId: string, companyId: string, invoiceId: string, ip?: string, userAgent?: string) {
    const existing = await this.requireInvoice(companyId, invoiceId);
    const allocated = existing.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
    if (allocated > 0) {
      throw new BadRequestException('Cannot void invoice with allocations');
    }

    const updated = await this.prisma.financeInvoice.update({
      where: { id: existing.id },
      data: { status: 'VOID' },
      include: { counterparty: true, lines: true, paymentAllocations: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.invoice.void',
      'finance_invoice',
      updated.id,
      { invoiceNo: updated.invoiceNo, status: updated.status },
      ip,
      userAgent
    );

    return updated;
  }

  async deleteInvoice(actorUserId: string, companyId: string, invoiceId: string, ip?: string, userAgent?: string) {
    const existing = await this.requireInvoice(companyId, invoiceId);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be deleted');
    }
    if (existing.paymentAllocations.length > 0) {
      throw new BadRequestException('Cannot delete invoice with allocations');
    }

    await this.prisma.financeInvoice.delete({ where: { id: existing.id } });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.invoice.delete',
      'finance_invoice',
      existing.id,
      { invoiceNo: existing.invoiceNo },
      ip,
      userAgent
    );

    return { success: true };
  }

  async listPayments(companyId: string, query: unknown) {
    const parsed = financePaymentQuerySchema.parse(query) as PaymentFilters;
    return this.prisma.financePayment.findMany({
      where: {
        companyId,
        ...(parsed.direction ? { direction: parsed.direction } : {}),
        ...(parsed.counterpartyId ? { counterpartyId: parsed.counterpartyId } : {}),
        ...(parsed.from || parsed.to
          ? {
              paymentDate: {
                ...(parsed.from ? { gte: this.parseDateValue(parsed.from, false) } : {}),
                ...(parsed.to ? { lte: this.parseDateValue(parsed.to, true) } : {})
              }
            }
          : {})
      },
      include: { counterparty: true, account: true, allocations: true },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createPayment(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financePaymentSchema.parse(payload);
    await this.requireCounterparty(companyId, body.counterpartyId);
    if (body.accountId) {
      await this.requireAccount(companyId, body.accountId);
    }

    const payment = await this.prisma.financePayment.create({
      data: {
        companyId,
        direction: body.direction,
        counterpartyId: body.counterpartyId,
        accountId: body.accountId ?? null,
        paymentDate: this.parseDateValue(body.paymentDate),
        amount: new Prisma.Decimal(body.amount),
        currency: body.currency,
        reference: body.reference ?? null,
        notes: body.notes ?? null,
        createdByUserId: actorUserId
      },
      include: { counterparty: true, account: true, allocations: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.payment.create',
      'finance_payment',
      payment.id,
      { direction: payment.direction, counterpartyId: payment.counterpartyId, amount: Number(payment.amount) },
      ip,
      userAgent
    );

    return payment;
  }

  async getPayment(companyId: string, paymentId: string) {
    return this.requirePayment(companyId, paymentId);
  }

  async updatePayment(
    actorUserId: string,
    companyId: string,
    paymentId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financePaymentSchema.partial().parse(payload);
    const existing = await this.requirePayment(companyId, paymentId);
    if (body.counterpartyId) {
      await this.requireCounterparty(companyId, body.counterpartyId);
    }
    if (body.accountId) {
      await this.requireAccount(companyId, body.accountId);
    }

    const allocated = existing.allocations.reduce((sum, row) => sum + Number(row.amount), 0);
    if (body.amount !== undefined && body.amount < allocated) {
      throw new BadRequestException('Payment amount cannot be lower than allocated total');
    }

    const updated = await this.prisma.financePayment.update({
      where: { id: existing.id },
      data: {
        ...(body.direction ? { direction: body.direction } : {}),
        ...(body.counterpartyId ? { counterpartyId: body.counterpartyId } : {}),
        ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
        ...(body.paymentDate ? { paymentDate: this.parseDateValue(body.paymentDate) } : {}),
        ...(body.amount !== undefined ? { amount: new Prisma.Decimal(body.amount) } : {}),
        ...(body.currency ? { currency: body.currency } : {}),
        ...(body.reference !== undefined ? { reference: body.reference } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      },
      include: { counterparty: true, account: true, allocations: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.payment.update',
      'finance_payment',
      updated.id,
      { direction: updated.direction, counterpartyId: updated.counterpartyId, amount: Number(updated.amount) },
      ip,
      userAgent
    );

    return updated;
  }

  async allocatePayment(
    actorUserId: string,
    companyId: string,
    paymentId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = financePaymentAllocateSchema.parse(payload);
    const payment = await this.requirePayment(companyId, paymentId);
    const existingAllocated = payment.allocations.reduce((sum, row) => sum + Number(row.amount), 0);
    const requestAllocated = body.allocations.reduce((sum, row) => sum + row.amount, 0);
    const paymentTotal = Number(payment.amount);

    if (existingAllocated + requestAllocated > paymentTotal + 0.0001) {
      throw new BadRequestException('Allocations exceed payment amount');
    }

    const invoiceIds = [...new Set(body.allocations.map((row) => row.invoiceId))];
    const invoices = await this.prisma.financeInvoice.findMany({
      where: { companyId, id: { in: invoiceIds } },
      include: { paymentAllocations: true }
    });

    if (invoices.length !== invoiceIds.length) {
      throw new NotFoundException('One or more invoices not found');
    }

    for (const invoice of invoices) {
      if (invoice.counterpartyId !== payment.counterpartyId) {
        throw new BadRequestException('Payment and invoice counterparty mismatch');
      }
      if (invoice.status === 'VOID') {
        throw new BadRequestException('Cannot allocate to void invoice');
      }

      const expectedDirection = payment.direction === 'INCOMING' ? 'RECEIVABLE' : 'PAYABLE';
      if (invoice.direction !== expectedDirection) {
        throw new BadRequestException('Payment direction does not match invoice direction');
      }

      const alreadyAllocated = invoice.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
      const requestedForInvoice = body.allocations
        .filter((row) => row.invoiceId === invoice.id)
        .reduce((sum, row) => sum + row.amount, 0);
      const outstanding = Number(invoice.total) - alreadyAllocated;
      if (requestedForInvoice > outstanding + 0.0001) {
        throw new BadRequestException(`Allocation exceeds invoice outstanding amount for ${invoice.invoiceNo}`);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const row of body.allocations) {
        const allocation = await tx.financePaymentAllocation.create({
          data: {
            companyId,
            paymentId: payment.id,
            invoiceId: row.invoiceId,
            amount: new Prisma.Decimal(row.amount)
          }
        });
        created.push(allocation);
      }

      for (const invoiceId of invoiceIds) {
        await this.recalculateInvoiceStatus(tx, invoiceId);
      }

      return tx.financePayment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { counterparty: true, account: true, allocations: true }
      });
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.payment.allocate',
      'finance_payment',
      result.id,
      { allocations: body.allocations, allocatedTotal: requestAllocated },
      ip,
      userAgent
    );

    return result;
  }

  listBudgets(companyId: string) {
    return this.prisma.financeBudget.findMany({
      where: { companyId },
      include: {
        _count: { select: { lines: true } }
      },
      orderBy: [{ isActive: 'desc' }, { year: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createBudget(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeBudgetSchema.parse(payload);
    const row = await this.prisma.financeBudget.create({
      data: {
        companyId,
        name: body.name,
        year: body.year,
        currency: body.currency,
        isActive: body.isActive ?? true,
        createdByUserId: actorUserId
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.budget.create', 'finance_budget', row.id, body, ip, userAgent);
    return row;
  }

  async getBudget(companyId: string, id: string) {
    return this.requireBudget(companyId, id);
  }

  async updateBudget(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeBudgetSchema.partial().parse(payload);
    const existing = await this.requireBudget(companyId, id);

    const row = await this.prisma.financeBudget.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.year !== undefined ? { year: body.year } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.budget.update', 'finance_budget', row.id, body, ip, userAgent);
    return row;
  }

  async duplicateBudget(actorUserId: string, companyId: string, id: string, yearRaw: string | undefined, ip?: string, userAgent?: string) {
    const existing = await this.requireBudget(companyId, id);
    const lines = await this.prisma.financeBudgetLine.findMany({
      where: { companyId, budgetId: existing.id }
    });
    const year = yearRaw ? Number(yearRaw) : existing.year + 1;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Invalid target year');
    }

    const clone = await this.prisma.$transaction(async (tx) => {
      const budget = await tx.financeBudget.create({
        data: {
          companyId,
          name: `${existing.name} (${year})`,
          year,
          currency: existing.currency,
          isActive: false,
          createdByUserId: actorUserId
        }
      });

      for (const line of lines) {
        await tx.financeBudgetLine.create({
          data: {
            companyId,
            budgetId: budget.id,
            month: line.month,
            direction: line.direction,
            categoryId: line.categoryId,
            profitCenterId: line.profitCenterId,
            amount: line.amount,
            notes: line.notes
          }
        });
      }

      return budget;
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.budget.duplicate',
      'finance_budget',
      clone.id,
      { sourceBudgetId: id, year },
      ip,
      userAgent
    );

    return clone;
  }

  async activateBudget(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const budget = await this.requireBudget(companyId, id);
    const row = await this.prisma.financeBudget.update({
      where: { id: budget.id },
      data: { isActive: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.budget.activate', 'finance_budget', row.id, {}, ip, userAgent);
    return row;
  }

  async deactivateBudget(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const budget = await this.requireBudget(companyId, id);
    const row = await this.prisma.financeBudget.update({
      where: { id: budget.id },
      data: { isActive: false }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.budget.deactivate', 'finance_budget', row.id, {}, ip, userAgent);
    return row;
  }

  async listBudgetLines(companyId: string, budgetId: string) {
    await this.requireBudget(companyId, budgetId);
    return this.prisma.financeBudgetLine.findMany({
      where: { companyId, budgetId },
      include: { category: true, profitCenter: true },
      orderBy: [{ month: 'asc' }, { direction: 'asc' }]
    });
  }

  async upsertBudgetLines(actorUserId: string, companyId: string, budgetId: string, payload: unknown, ip?: string, userAgent?: string) {
    await this.requireBudget(companyId, budgetId);
    const body = financeBudgetLinesBulkSchema.parse(payload);

    for (const line of body.lines) {
      if (line.categoryId) await this.requireCategory(companyId, line.categoryId);
      if (line.profitCenterId) await this.requireProfitCenter(companyId, line.profitCenterId);
    }

    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.financeBudgetLine.deleteMany({ where: { companyId, budgetId } });
      for (const line of body.lines) {
        await tx.financeBudgetLine.create({
          data: {
            companyId,
            budgetId,
            month: line.month,
            direction: line.direction,
            categoryId: line.categoryId ?? null,
            profitCenterId: line.profitCenterId ?? null,
            amount: new Prisma.Decimal(line.amount),
            notes: line.notes ?? null
          }
        });
      }

      return tx.financeBudgetLine.findMany({
        where: { companyId, budgetId },
        include: { category: true, profitCenter: true },
        orderBy: [{ month: 'asc' }, { direction: 'asc' }]
      });
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.finance.budget.lines.upsert',
      'finance_budget',
      budgetId,
      { lineCount: body.lines.length },
      ip,
      userAgent
    );

    return rows;
  }

  listCashflowForecastItems(companyId: string) {
    return this.prisma.financeCashflowForecastItem.findMany({
      where: { companyId },
      include: { profitCenter: true, createdByUser: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async createCashflowForecastItem(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeCashflowForecastItemSchema.parse(payload);
    if (body.profitCenterId) await this.requireProfitCenter(companyId, body.profitCenterId);

    const row = await this.prisma.financeCashflowForecastItem.create({
      data: {
        companyId,
        direction: body.direction,
        date: this.parseDateValue(body.date),
        amount: new Prisma.Decimal(body.amount),
        currency: body.currency,
        description: body.description,
        profitCenterId: body.profitCenterId ?? null,
        createdByUserId: actorUserId
      },
      include: { profitCenter: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.cashflow_forecast.create', 'finance_cashflow_forecast_item', row.id, body, ip, userAgent);
    return row;
  }

  async updateCashflowForecastItem(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = financeCashflowForecastItemSchema.partial().parse(payload);
    const existing = await this.requireCashflowForecastItem(companyId, id);
    if (body.profitCenterId) await this.requireProfitCenter(companyId, body.profitCenterId);

    const row = await this.prisma.financeCashflowForecastItem.update({
      where: { id: existing.id },
      data: {
        ...(body.direction !== undefined ? { direction: body.direction } : {}),
        ...(body.date !== undefined ? { date: this.parseDateValue(body.date) } : {}),
        ...(body.amount !== undefined ? { amount: new Prisma.Decimal(body.amount) } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.profitCenterId !== undefined ? { profitCenterId: body.profitCenterId } : {})
      },
      include: { profitCenter: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.finance.cashflow_forecast.update', 'finance_cashflow_forecast_item', row.id, body, ip, userAgent);
    return row;
  }

  async agingReport(companyId: string, query: unknown) {
    const parsed = financeAgingQuerySchema.parse(query);
    const asOf = this.parseDateValue(parsed.asOf, true);

    const invoices = await this.prisma.financeInvoice.findMany({
      where: {
        companyId,
        direction: parsed.direction,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] }
      },
      include: { counterparty: true, paymentAllocations: true }
    });

    type AgingBuckets = { current: number; b1_30: number; b31_60: number; b61_90: number; b90_plus: number; total: number };
    const grouped = new Map<string, { counterpartyId: string; counterpartyName: string; buckets: AgingBuckets }>();
    const totals: AgingBuckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 };

    for (const invoice of invoices) {
      const allocated = invoice.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
      const outstanding = Math.max(0, Number(invoice.total) - allocated);
      if (outstanding <= 0) continue;

      const diffDays = Math.floor((asOf.getTime() - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const row =
        grouped.get(invoice.counterpartyId) ??
        {
          counterpartyId: invoice.counterpartyId,
          counterpartyName: invoice.counterparty.name,
          buckets: { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 }
        };

      if (diffDays <= 0) row.buckets.current += outstanding;
      else if (diffDays <= 30) row.buckets.b1_30 += outstanding;
      else if (diffDays <= 60) row.buckets.b31_60 += outstanding;
      else if (diffDays <= 90) row.buckets.b61_90 += outstanding;
      else row.buckets.b90_plus += outstanding;
      row.buckets.total += outstanding;
      grouped.set(invoice.counterpartyId, row);
    }

    for (const row of grouped.values()) {
      totals.current += row.buckets.current;
      totals.b1_30 += row.buckets.b1_30;
      totals.b31_60 += row.buckets.b31_60;
      totals.b61_90 += row.buckets.b61_90;
      totals.b90_plus += row.buckets.b90_plus;
      totals.total += row.buckets.total;
    }

    return {
      direction: parsed.direction,
      asOf: parsed.asOf,
      totals,
      items: Array.from(grouped.values()).sort((a, b) => b.buckets.total - a.buckets.total)
    };
  }

  async counterpartyBalanceReport(companyId: string, query: unknown) {
    const parsed = financeCounterpartyBalanceQuerySchema.parse(query);
    const invoices = await this.prisma.financeInvoice.findMany({
      where: {
        companyId,
        direction: parsed.direction,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] }
      },
      include: { counterparty: true, paymentAllocations: true }
    });

    const grouped = new Map<string, { counterpartyId: string; counterpartyName: string; outstanding: number; invoiceCount: number }>();

    for (const invoice of invoices) {
      const allocated = invoice.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
      const outstanding = Math.max(0, Number(invoice.total) - allocated);
      if (outstanding <= 0) continue;

      const row =
        grouped.get(invoice.counterpartyId) ??
        { counterpartyId: invoice.counterpartyId, counterpartyName: invoice.counterparty.name, outstanding: 0, invoiceCount: 0 };
      row.outstanding += outstanding;
      row.invoiceCount += 1;
      grouped.set(invoice.counterpartyId, row);
    }

    return {
      direction: parsed.direction,
      items: Array.from(grouped.values()).sort((a, b) => b.outstanding - a.outstanding),
      totalOutstanding: Array.from(grouped.values()).reduce((sum, row) => sum + row.outstanding, 0)
    };
  }

  async budgetVsActualReport(companyId: string, query: unknown) {
    const parsed = financeBudgetVsActualQuerySchema.parse(query);
    const budget = await this.requireBudget(companyId, parsed.budgetId);
    const range = this.reportRange(parsed.from, parsed.to);

    if (range.from.getUTCFullYear() !== budget.year || range.to.getUTCFullYear() !== budget.year) {
      throw new BadRequestException('Selected date range must be within budget year');
    }

    if (parsed.categoryId) await this.requireCategory(companyId, parsed.categoryId);
    if (parsed.profitCenterId) await this.requireProfitCenter(companyId, parsed.profitCenterId);

    const budgetLines = await this.prisma.financeBudgetLine.findMany({
      where: {
        companyId,
        budgetId: budget.id,
        ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.profitCenterId ? { profitCenterId: parsed.profitCenterId } : {})
      },
      include: { category: true, profitCenter: true }
    });

    const entries = await this.prisma.financeEntry.findMany({
      where: {
        companyId,
        date: { gte: range.from, lte: range.to },
        ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.profitCenterId ? { profitCenterId: parsed.profitCenterId } : {})
      },
      include: { category: true }
    });

    const monthly = new Map<
      string,
      {
        month: string;
        budgetIncome: number;
        budgetExpense: number;
        actualIncome: number;
        actualExpense: number;
      }
    >();

    for (let month = range.from.getUTCMonth() + 1; month <= range.to.getUTCMonth() + 1; month += 1) {
      const key = `${budget.year}-${String(month).padStart(2, '0')}`;
      monthly.set(key, { month: key, budgetIncome: 0, budgetExpense: 0, actualIncome: 0, actualExpense: 0 });
    }

    for (const line of budgetLines) {
      const key = `${budget.year}-${String(line.month).padStart(2, '0')}`;
      const bucket =
        monthly.get(key) ??
        (() => {
          const seed = { month: key, budgetIncome: 0, budgetExpense: 0, actualIncome: 0, actualExpense: 0 };
          monthly.set(key, seed);
          return seed;
        })();
      if (line.direction === 'INCOME') bucket.budgetIncome += Number(line.amount);
      else bucket.budgetExpense += Number(line.amount);
    }

    for (const entry of entries) {
      const key = `${entry.date.getUTCFullYear()}-${String(entry.date.getUTCMonth() + 1).padStart(2, '0')}`;
      const bucket =
        monthly.get(key) ??
        (() => {
          const seed = { month: key, budgetIncome: 0, budgetExpense: 0, actualIncome: 0, actualExpense: 0 };
          monthly.set(key, seed);
          return seed;
        })();
      if (entry.category.type === 'INCOME') bucket.actualIncome += Number(entry.amount);
      else bucket.actualExpense += Number(entry.amount);
    }

    const rows = Array.from(monthly.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        ...row,
        budgetNet: row.budgetIncome - row.budgetExpense,
        actualNet: row.actualIncome - row.actualExpense,
        variance: row.actualIncome - row.actualExpense - (row.budgetIncome - row.budgetExpense)
      }));

    const totals = rows.reduce(
      (acc, row) => {
        acc.budgetIncome += row.budgetIncome;
        acc.budgetExpense += row.budgetExpense;
        acc.actualIncome += row.actualIncome;
        acc.actualExpense += row.actualExpense;
        return acc;
      },
      { budgetIncome: 0, budgetExpense: 0, actualIncome: 0, actualExpense: 0 }
    );

    const budgetNet = totals.budgetIncome - totals.budgetExpense;
    const actualNet = totals.actualIncome - totals.actualExpense;
    const variance = actualNet - budgetNet;

    return {
      budget: { id: budget.id, name: budget.name, year: budget.year, currency: budget.currency },
      filters: parsed,
      totals: {
        budgetIncome: totals.budgetIncome,
        budgetExpense: totals.budgetExpense,
        budgetNet,
        actualIncome: totals.actualIncome,
        actualExpense: totals.actualExpense,
        actualNet,
        variance,
        variancePercent: budgetNet === 0 ? null : (variance / Math.abs(budgetNet)) * 100
      },
      byMonth: rows
    };
  }

  async cashflowProjection(companyId: string, query: unknown) {
    const parsed = financeCashflowProjectionQuerySchema.parse(query);
    const range = this.reportRange(parsed.from, parsed.to);

    const [invoices, recurringRules, manualForecasts] = await Promise.all([
      this.prisma.financeInvoice.findMany({
        where: {
          companyId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
          dueDate: { gte: range.from, lte: range.to }
        },
        include: { paymentAllocations: true }
      }),
      this.prisma.financeRecurringRule.findMany({
        where: { companyId, isActive: true, nextRunAt: { lte: range.to } }
      }),
      this.prisma.financeCashflowForecastItem.findMany({
        where: { companyId, date: { gte: range.from, lte: range.to } }
      })
    ]);

    const buckets = new Map<string, { bucketStart: string; inflow: number; outflow: number; sources: Record<string, number> }>();
    const ensureBucket = (date: Date) => {
      const bucketStart = this.weekStart(date);
      const key = bucketStart.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, { bucketStart: key, inflow: 0, outflow: 0, sources: { invoices: 0, recurring: 0, manual: 0 } });
      }
      return buckets.get(key)!;
    };

    for (const invoice of invoices) {
      const allocated = invoice.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
      const outstanding = Math.max(0, Number(invoice.total) - allocated);
      if (outstanding <= 0) continue;
      const bucket = ensureBucket(invoice.dueDate);
      if (invoice.direction === 'RECEIVABLE') bucket.inflow += outstanding;
      else bucket.outflow += outstanding;
      bucket.sources.invoices += outstanding;
    }

    for (const rule of recurringRules) {
      const occurrences = this.recurringOccurrencesInRange(rule, range.from, range.to);
      for (const at of occurrences) {
        const amount = Number(rule.amount);
        const bucket = ensureBucket(at);
        if (rule.direction === 'INCOME') bucket.inflow += amount;
        else bucket.outflow += amount;
        bucket.sources.recurring += amount;
      }
    }

    for (const row of manualForecasts) {
      const bucket = ensureBucket(row.date);
      const amount = Number(row.amount);
      if (row.direction === 'INFLOW') bucket.inflow += amount;
      else bucket.outflow += amount;
      bucket.sources.manual += amount;
    }

    const rows = Array.from(buckets.values())
      .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart))
      .map((row) => ({
        ...row,
        net: row.inflow - row.outflow
      }));

    return {
      from: parsed.from,
      to: parsed.to,
      granularity: 'week',
      totals: rows.reduce(
        (acc, row) => {
          acc.inflow += row.inflow;
          acc.outflow += row.outflow;
          acc.net += row.net;
          return acc;
        },
        { inflow: 0, outflow: 0, net: 0 }
      ),
      buckets: rows
    };
  }

  async listEntries(companyId: string, filters: EntryFilters) {
    const where: Prisma.FinanceEntryWhereInput = {
      companyId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.counterpartyId ? { counterpartyId: filters.counterpartyId } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.profitCenterId ? { profitCenterId: filters.profitCenterId } : {}),
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
      include: { category: true, counterparty: true, account: true, profitCenter: true, recurringRule: true, createdByUser: true },
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
        profitCenterId: body.profitCenterId ?? null,
        invoiceId: body.invoiceId ?? null,
        paymentId: body.paymentId ?? null,
        relatedDocumentType: body.relatedDocumentType ?? null,
        relatedDocumentId: body.relatedDocumentId ?? null,
        reference: body.reference ?? null,
        amount: new Prisma.Decimal(body.amount),
        date: this.parseDateValue(body.date),
        description: body.description,
        createdByUserId: actorUserId
      },
      include: { category: true, counterparty: true, account: true, profitCenter: true }
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
        profitCenterId: body.profitCenterId ?? null,
        invoiceId: body.invoiceId ?? null,
        paymentId: body.paymentId ?? null,
        relatedDocumentType: body.relatedDocumentType ?? null,
        relatedDocumentId: body.relatedDocumentId ?? null,
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
        ...(body.profitCenterId !== undefined ? { profitCenterId: body.profitCenterId } : {}),
        ...(body.invoiceId !== undefined ? { invoiceId: body.invoiceId } : {}),
        ...(body.paymentId !== undefined ? { paymentId: body.paymentId } : {}),
        ...(body.relatedDocumentType !== undefined ? { relatedDocumentType: body.relatedDocumentType } : {}),
        ...(body.relatedDocumentId !== undefined ? { relatedDocumentId: body.relatedDocumentId } : {}),
        ...(body.reference !== undefined ? { reference: body.reference } : {}),
        ...(body.amount !== undefined ? { amount: new Prisma.Decimal(body.amount) } : {}),
        ...(body.date ? { date: this.parseDateValue(body.date) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {})
      },
      include: { category: true, counterparty: true, account: true, profitCenter: true }
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
        profitCenterId: body.profitCenterId ?? entry.profitCenterId,
        invoiceId: body.invoiceId ?? entry.invoiceId,
        paymentId: body.paymentId ?? entry.paymentId,
        relatedDocumentType: body.relatedDocumentType ?? entry.relatedDocumentType,
        relatedDocumentId: body.relatedDocumentId ?? entry.relatedDocumentId,
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
        profitCenterId: existing.profitCenterId,
        invoiceId: existing.invoiceId,
        paymentId: existing.paymentId,
        relatedDocumentType: existing.relatedDocumentType,
        relatedDocumentId: existing.relatedDocumentId,
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

  async pnlByProfitCenter(companyId: string, query: unknown) {
    const parsed = financeProfitCenterReportSchema.parse(query);
    const range = this.reportRange(parsed.from, parsed.to);

    if (parsed.profitCenterId) {
      const center = await this.requireProfitCenter(companyId, parsed.profitCenterId);
      const entries = await this.prisma.financeEntry.findMany({
        where: {
          companyId,
          profitCenterId: center.id,
          date: { gte: range.from, lte: range.to }
        },
        include: { category: true }
      });

      let income = 0;
      let expense = 0;
      const byCategory = new Map<string, { categoryId: string; categoryName: string; type: string; total: number }>();

      for (const entry of entries) {
        const amount = Number(entry.amount);
        if (entry.category.type === 'INCOME') income += amount;
        else expense += amount;

        const key = entry.categoryId;
        const row = byCategory.get(key) ?? {
          categoryId: entry.categoryId,
          categoryName: entry.category.name,
          type: entry.category.type,
          total: 0
        };
        row.total += amount;
        byCategory.set(key, row);
      }

      return {
        from: parsed.from,
        to: parsed.to,
        profitCenter: { id: center.id, name: center.name, code: center.code, type: center.type },
        totals: { income, expense, net: income - expense },
        byCategory: Array.from(byCategory.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
      };
    }

    const entries = await this.prisma.financeEntry.findMany({
      where: {
        companyId,
        date: { gte: range.from, lte: range.to }
      },
      include: { category: true, profitCenter: true }
    });

    const grouped = new Map<
      string,
      { profitCenterId: string | null; profitCenterName: string; income: number; expense: number; net: number }
    >();

    for (const entry of entries) {
      const key = entry.profitCenterId ?? 'unassigned';
      const row = grouped.get(key) ?? {
        profitCenterId: entry.profitCenterId,
        profitCenterName: entry.profitCenter?.name ?? 'Unassigned',
        income: 0,
        expense: 0,
        net: 0
      };
      const amount = Number(entry.amount);
      if (entry.category.type === 'INCOME') row.income += amount;
      else row.expense += amount;
      row.net = row.income - row.expense;
      grouped.set(key, row);
    }

    return {
      from: parsed.from,
      to: parsed.to,
      items: Array.from(grouped.values()).sort((a, b) => a.profitCenterName.localeCompare(b.profitCenterName))
    };
  }

  async profitCenterComparison(companyId: string, query: unknown) {
    const parsed = financeProfitCenterReportSchema.parse(query);
    this.reportRange(parsed.from, parsed.to);

    const summary = await this.pnlByProfitCenter(companyId, { from: parsed.from, to: parsed.to });
    const items = Array.isArray((summary as { items?: unknown }).items)
      ? (summary as { items: Array<{ profitCenterId: string | null; profitCenterName: string; income: number; expense: number; net: number }> })
          .items
      : [];

    return {
      from: parsed.from,
      to: parsed.to,
      items: [...items].sort((a, b) => b.net - a.net)
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
      profitCenterId?: string | null;
      invoiceId?: string | null;
      paymentId?: string | null;
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
    if (body.profitCenterId) {
      await this.requireProfitCenter(companyId, body.profitCenterId);
    }
    if (body.invoiceId) {
      await this.requireInvoice(companyId, body.invoiceId);
    }
    if (body.paymentId) {
      await this.requirePayment(companyId, body.paymentId);
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

  private async requireProfitCenter(companyId: string, id: string) {
    const row = await this.prisma.financeProfitCenter.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Profit center not found');
    }
    return row;
  }

  private async requireEntry(companyId: string, id: string) {
    const row = await this.prisma.financeEntry.findUnique({
      where: { id },
      include: { category: true }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Entry not found');
    }
    return row;
  }

  private async requireAllocationRule(companyId: string, id: string) {
    const row = await this.prisma.financeAllocationRule.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Allocation rule not found');
    }
    return row;
  }

  private async requireInvoice(companyId: string, id: string) {
    const row = await this.prisma.financeInvoice.findUnique({
      where: { id },
      include: {
        counterparty: true,
        lines: true,
        paymentAllocations: true
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Invoice not found');
    }
    return row;
  }

  private async requirePayment(companyId: string, id: string) {
    const row = await this.prisma.financePayment.findUnique({
      where: { id },
      include: {
        counterparty: true,
        account: true,
        allocations: true
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Payment not found');
    }
    return row;
  }

  private async requireBudget(companyId: string, id: string) {
    const row = await this.prisma.financeBudget.findUnique({
      where: { id },
      include: {
        _count: { select: { lines: true } }
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Budget not found');
    }
    return row;
  }

  private async requireCashflowForecastItem(companyId: string, id: string) {
    const row = await this.prisma.financeCashflowForecastItem.findUnique({
      where: { id },
      include: { profitCenter: true }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Cashflow forecast item not found');
    }
    return row;
  }

  private async assertNoProfitCenterCycle(companyId: string, currentId: string, nextParentId: string) {
    let cursor: string | null = nextParentId;
    while (cursor) {
      if (cursor === currentId) {
        throw new BadRequestException('Profit center hierarchy cycle is not allowed');
      }
      const parent: { id: string; companyId: string; parentId: string | null } | null = await this.prisma.financeProfitCenter.findUnique({
        where: { id: cursor },
        select: { id: true, companyId: true, parentId: true }
      });
      if (!parent || parent.companyId !== companyId) {
        throw new BadRequestException('Invalid parent profit center');
      }
      cursor = parent.parentId;
    }
  }

  private weekStart(date: Date) {
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utc.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    utc.setUTCDate(utc.getUTCDate() - diffToMonday);
    return utc;
  }

  private recurringOccurrencesInRange(rule: FinanceRecurringRule, from: Date, to: Date) {
    const occurrences: Date[] = [];
    let cursor = new Date(rule.nextRunAt);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));
    const limit = 400;
    let guard = 0;

    while (cursor <= to && guard < limit) {
      if (cursor >= from) {
        occurrences.push(new Date(cursor));
      }

      if (rule.frequency === 'WEEKLY') {
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      } else {
        const dayOfMonth = rule.dayOfMonth ?? cursor.getUTCDate();
        const nextMonth = cursor.getUTCMonth() + 1;
        const nextYear = cursor.getUTCFullYear() + Math.floor(nextMonth / 12);
        const normalizedMonth = nextMonth % 12;
        const lastDay = new Date(Date.UTC(nextYear, normalizedMonth + 1, 0)).getUTCDate();
        const day = Math.min(dayOfMonth, lastDay);
        cursor = new Date(Date.UTC(nextYear, normalizedMonth, day));
      }

      guard += 1;
    }

    return occurrences;
  }

  private assertAllocationRuleSources(sourceCategoryId?: string | null, sourceEntryId?: string | null) {
    if (sourceCategoryId && sourceEntryId) {
      throw new BadRequestException('Allocation rule sourceCategoryId and sourceEntryId cannot both be set');
    }
  }

  private assertAllocationTotal(targets: Array<{ percentage: number }>) {
    const total = targets.reduce((sum, target) => sum + target.percentage, 0);
    if (Math.abs(total - 100) > 0.0001) {
      throw new BadRequestException('Allocation target percentages must add up to 100');
    }
  }

  private async validateAllocationTargets(companyId: string, targets: Array<{ profitCenterId: string; percentage: number }>) {
    const unique = new Set<string>();
    for (const target of targets) {
      if (unique.has(target.profitCenterId)) {
        throw new BadRequestException('Duplicate profit center in allocation targets');
      }
      unique.add(target.profitCenterId);
      await this.requireProfitCenter(companyId, target.profitCenterId);
    }
  }

  private computeLineTotal(quantity: number, unitPrice: number, taxRate?: number | null) {
    const base = quantity * unitPrice;
    const tax = taxRate ? (base * taxRate) / 100 : 0;
    return new Prisma.Decimal((base + tax).toFixed(2));
  }

  private computeInvoiceTotals(lines: Array<{ quantity: number; unitPrice: number; taxRate?: number | null }>) {
    let subtotal = 0;
    let taxTotal = 0;

    for (const line of lines) {
      const base = line.quantity * line.unitPrice;
      if (base < 0) {
        throw new BadRequestException('Invoice line total cannot be negative');
      }
      subtotal += base;
      taxTotal += line.taxRate ? (base * line.taxRate) / 100 : 0;
    }

    const total = subtotal + taxTotal;
    if (total < 0) {
      throw new BadRequestException('Invoice total cannot be negative');
    }

    return {
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      taxTotal: new Prisma.Decimal(taxTotal.toFixed(2)),
      total: new Prisma.Decimal(total.toFixed(2))
    };
  }

  private async recalculateInvoiceStatus(tx: Prisma.TransactionClient, invoiceId: string) {
    const invoice = await tx.financeInvoice.findUnique({
      where: { id: invoiceId },
      include: { paymentAllocations: true }
    });

    if (!invoice || invoice.status === 'VOID') {
      return;
    }

    const allocated = invoice.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
    const total = Number(invoice.total);

    let status: 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' = 'ISSUED';
    if (allocated >= total - 0.0001) status = 'PAID';
    else if (allocated > 0) status = 'PARTIALLY_PAID';

    await tx.financeInvoice.update({
      where: { id: invoiceId },
      data: { status }
    });
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
