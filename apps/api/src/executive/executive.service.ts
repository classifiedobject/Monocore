import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { executiveDashboardQuerySchema } from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type TrendPoint = { date: string; value: number };

type DashboardSummary = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  cashPosition: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  inventoryValue: number;
  reservationCount: number;
  taskOverdueCount: number;
};

type FinanceEntryWithCategory = {
  amount: Prisma.Decimal;
  date: Date;
  relatedDocumentType: string | null;
  category: { type: 'INCOME' | 'EXPENSE'; name: string };
};

@Injectable()
export class ExecutiveService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async dashboard(actorUserId: string, companyId: string, query: unknown, ip?: string, userAgent?: string) {
    const parsed = executiveDashboardQuerySchema.parse(query);
    const { from, to } = this.resolveDateRange(parsed.from, parsed.to);
    const bucket = this.bucketMode(from, to);

    const [
      financeEntries,
      cashflowRows,
      outstandingReceivables,
      outstandingPayables,
      cashPosition,
      inventory,
      reservationCount,
      taskOverdueCount,
      overdueInvoices,
      overdueTasks
    ] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where: {
          companyId,
          date: { gte: from, lte: to }
        },
        include: { category: true },
        orderBy: { date: 'asc' }
      }),
      this.prisma.financePayment.findMany({
        where: { companyId, paymentDate: { gte: from, lte: to } },
        select: { paymentDate: true, direction: true, amount: true },
        orderBy: { paymentDate: 'asc' }
      }),
      this.outstandingInvoiceTotal(companyId, 'RECEIVABLE'),
      this.outstandingInvoiceTotal(companyId, 'PAYABLE'),
      this.calculateCashPosition(companyId),
      this.inventorySnapshot(companyId),
      this.prisma.reservation.count({ where: { companyId, reservationDate: { gte: from, lte: to } } }),
      this.prisma.taskInstance.count({
        where: {
          companyId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueDate: { lt: this.startOfDay(new Date()) }
        }
      }),
      this.prisma.financeInvoice.count({
        where: {
          companyId,
          dueDate: { lt: this.startOfDay(new Date()) },
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] }
        }
      }),
      this.prisma.taskInstance.findMany({
        where: {
          companyId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueDate: { lt: this.startOfDay(new Date()) }
        },
        select: { id: true, title: true, dueDate: true, assigneeUser: { select: { fullName: true } } },
        orderBy: [{ dueDate: 'asc' }],
        take: 8
      })
    ]);

    const revenue = this.sum(
      financeEntries
        .filter((row) => row.category.type === 'INCOME' && row.relatedDocumentType === 'sale')
        .map((r) => r.amount)
    );

    const cogs = this.sum(
      financeEntries
        .filter((row) => row.relatedDocumentType === 'sale' && row.category.name.toLowerCase().includes('cogs'))
        .map((r) => r.amount)
    );

    const totalIncome = this.sum(
      financeEntries.filter((row) => row.category.type === 'INCOME').map((r) => r.amount)
    );

    const totalExpense = this.sum(
      financeEntries.filter((row) => row.category.type === 'EXPENSE').map((r) => r.amount)
    );

    const summary: DashboardSummary = {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      netProfit: totalIncome - totalExpense,
      cashPosition,
      outstandingReceivables,
      outstandingPayables,
      inventoryValue: inventory.totalValue,
      reservationCount,
      taskOverdueCount
    };

    const trends = {
      revenueTrend: this.buildFinanceTrend(
        financeEntries.filter((row) => row.relatedDocumentType === 'sale' && row.category.type === 'INCOME'),
        from,
        to,
        bucket
      ),
      netProfitTrend: this.buildNetProfitTrend(financeEntries, from, to, bucket),
      cashflowTrend: this.buildCashflowTrend(cashflowRows, from, to, bucket)
    };

    const alerts = this.buildAlerts({
      summary,
      overdueInvoices,
      lowStockItems: inventory.lowStockItems.length
    });

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action: 'company.executive.dashboard.view',
      entityType: 'executive_dashboard',
      entityId: undefined,
      metadata: {
        from: this.toYmd(from),
        to: this.toYmd(to),
        alerts: alerts.length,
        bucket
      },
      ip,
      userAgent
    });

    return {
      summary,
      trends,
      alerts,
      lowStockItems: inventory.lowStockItems,
      overdueTasks: overdueTasks.map((row) => ({
        id: row.id,
        title: row.title,
        dueDate: this.toYmd(row.dueDate),
        assignee: row.assigneeUser?.fullName ?? null
      }))
    };
  }

  private buildFinanceTrend(rows: Array<{ date: Date; amount: Prisma.Decimal }>, from: Date, to: Date, mode: 'daily' | 'weekly'): TrendPoint[] {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = this.bucketKey(row.date, mode);
      map.set(key, (map.get(key) ?? 0) + this.toNumber(row.amount));
    }
    return this.fillBuckets(from, to, mode).map((date) => ({ date, value: map.get(date) ?? 0 }));
  }

  private buildNetProfitTrend(rows: FinanceEntryWithCategory[], from: Date, to: Date, mode: 'daily' | 'weekly'): TrendPoint[] {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = this.bucketKey(row.date, mode);
      const sign = row.category.type === 'INCOME' ? 1 : -1;
      map.set(key, (map.get(key) ?? 0) + sign * this.toNumber(row.amount));
    }
    return this.fillBuckets(from, to, mode).map((date) => ({ date, value: map.get(date) ?? 0 }));
  }

  private buildCashflowTrend(
    rows: Array<{ paymentDate: Date; direction: 'OUTGOING' | 'INCOMING'; amount: Prisma.Decimal }>,
    from: Date,
    to: Date,
    mode: 'daily' | 'weekly'
  ): TrendPoint[] {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = this.bucketKey(row.paymentDate, mode);
      const sign = row.direction === 'INCOMING' ? 1 : -1;
      map.set(key, (map.get(key) ?? 0) + sign * this.toNumber(row.amount));
    }
    return this.fillBuckets(from, to, mode).map((date) => ({ date, value: map.get(date) ?? 0 }));
  }

  private async outstandingInvoiceTotal(companyId: string, direction: 'RECEIVABLE' | 'PAYABLE') {
    const rows = await this.prisma.financeInvoice.findMany({
      where: {
        companyId,
        direction,
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] }
      },
      select: {
        id: true,
        total: true,
        paymentAllocations: { select: { amount: true } }
      }
    });

    let total = 0;
    for (const row of rows) {
      const allocated = row.paymentAllocations.reduce((sum, allocation) => sum + this.toNumber(allocation.amount), 0);
      total += Math.max(this.toNumber(row.total) - allocated, 0);
    }
    return total;
  }

  private async calculateCashPosition(companyId: string) {
    const rows = await this.prisma.financeEntry.findMany({
      where: {
        companyId,
        account: { type: { in: ['CASH', 'BANK'] } }
      },
      select: { amount: true, category: { select: { type: true } } }
    });

    return rows.reduce((sum, row) => {
      const sign = row.category.type === 'INCOME' ? 1 : -1;
      return sum + sign * this.toNumber(row.amount);
    }, 0);
  }

  private async inventorySnapshot(companyId: string) {
    const [items, movements] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, lastPurchaseUnitCost: true }
      }),
      this.prisma.inventoryStockMovement.groupBy({
        by: ['itemId', 'type'],
        where: { companyId },
        _sum: { quantity: true }
      })
    ]);

    const qtyByItem = new Map<string, number>();
    for (const row of movements) {
      const qty = this.toNumber(row._sum.quantity ?? 0);
      const delta = row.type === 'IN' || row.type === 'TRANSFER_IN' ? qty : row.type === 'ADJUSTMENT' ? qty : -qty;
      qtyByItem.set(row.itemId, (qtyByItem.get(row.itemId) ?? 0) + delta);
    }

    let totalValue = 0;
    const lowStockItems: Array<{ itemId: string; name: string; quantity: number; threshold: number }> = [];
    const lowStockThreshold = 10;

    for (const item of items) {
      const quantity = qtyByItem.get(item.id) ?? 0;
      const unitCost = this.toNumber(item.lastPurchaseUnitCost ?? 0);
      totalValue += quantity * unitCost;
      if (quantity < lowStockThreshold) {
        lowStockItems.push({ itemId: item.id, name: item.name, quantity, threshold: lowStockThreshold });
      }
    }

    return { totalValue, lowStockItems };
  }

  private buildAlerts(input: { summary: DashboardSummary; overdueInvoices: number; lowStockItems: number }) {
    const alerts: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string }> = [];

    if (input.overdueInvoices > 5) {
      alerts.push({
        type: 'overdue_invoices',
        severity: 'warning',
        message: `Overdue invoice count is ${input.overdueInvoices} (threshold: 5).`
      });
    }

    if (input.summary.cashPosition < 0) {
      alerts.push({
        type: 'cash_negative',
        severity: 'critical',
        message: `Cash position is negative (${input.summary.cashPosition.toFixed(2)}).`
      });
    }

    if (input.summary.revenue > 0) {
      const margin = (input.summary.grossProfit / input.summary.revenue) * 100;
      if (margin < 20) {
        alerts.push({
          type: 'gross_margin_low',
          severity: 'warning',
          message: `Gross margin is ${margin.toFixed(1)}%, below target 20%.`
        });
      }
    }

    if (input.lowStockItems > 0) {
      alerts.push({
        type: 'inventory_low_stock',
        severity: 'warning',
        message: `${input.lowStockItems} inventory items are below low-stock threshold.`
      });
    }

    if (input.summary.taskOverdueCount > 10) {
      alerts.push({
        type: 'tasks_overdue',
        severity: 'info',
        message: `${input.summary.taskOverdueCount} tasks are overdue.`
      });
    }

    return alerts;
  }

  private resolveDateRange(fromRaw?: string, toRaw?: string) {
    const now = new Date();
    const from = fromRaw ? this.parseDate(fromRaw, false) : this.startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    const to = toRaw ? this.parseDate(toRaw, true) : this.endOfDay(now);

    if (from > to) {
      throw new BadRequestException('from must be before to');
    }

    return { from, to };
  }

  private bucketMode(from: Date, to: Date): 'daily' | 'weekly' {
    const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    return days <= 30 ? 'daily' : 'weekly';
  }

  private fillBuckets(from: Date, to: Date, mode: 'daily' | 'weekly'): string[] {
    const keys: string[] = [];
    const cursor = this.startOfDay(from);

    if (mode === 'daily') {
      while (cursor <= to) {
        keys.push(this.toYmd(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return keys;
    }

    const weekCursor = this.startOfWeek(cursor);
    while (weekCursor <= to) {
      keys.push(this.toYmd(weekCursor));
      weekCursor.setDate(weekCursor.getDate() + 7);
    }
    return keys;
  }

  private bucketKey(value: Date, mode: 'daily' | 'weekly') {
    const date = new Date(value);
    return mode === 'daily' ? this.toYmd(date) : this.toYmd(this.startOfWeek(date));
  }

  private parseDate(input: string, endOfDay: boolean) {
    const date = new Date(input.length === 10 ? `${input}T00:00:00.000Z` : input);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${input}`);
    }
    return endOfDay ? this.endOfDay(date) : this.startOfDay(date);
  }

  private startOfDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private endOfDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  }

  private startOfWeek(date: Date) {
    const copy = this.startOfDay(date);
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() - (day - 1));
    return copy;
  }

  private toYmd(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private sum(values: Prisma.Decimal[]) {
    return values.reduce((sum, value) => sum + this.toNumber(value), 0);
  }

  private toNumber(value: Prisma.Decimal | number) {
    if (typeof value === 'number') return value;
    return Number(value.toString());
  }
}
