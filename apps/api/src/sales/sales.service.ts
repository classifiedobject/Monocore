import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InventoryMovementType } from '@prisma/client';
import { salesOrderQuerySchema, salesOrderSchema } from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

@Injectable()
export class SalesService {
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
      readOrder: keys.has('module:sales-core.order.read'),
      manageOrder: keys.has('module:sales-core.order.manage'),
      postOrder: keys.has('module:sales-core.order.post'),
      financeEntryCreate: keys.has('module:finance-core.entry.create')
    };
  }

  async listOrders(companyId: string, query: unknown) {
    const parsed = salesOrderQuerySchema.parse(query);
    return this.prisma.salesOrder.findMany({
      where: {
        companyId,
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.profitCenterId ? { profitCenterId: parsed.profitCenterId } : {}),
        ...(parsed.from || parsed.to
          ? {
              orderDate: {
                ...(parsed.from ? { gte: this.parseDateValue(parsed.from, false) } : {}),
                ...(parsed.to ? { lte: this.parseDateValue(parsed.to, true) } : {})
              }
            }
          : {})
      },
      include: {
        warehouse: true,
        profitCenter: true,
        lines: { include: { product: true }, orderBy: { createdAt: 'asc' } }
      },
      orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createOrder(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = salesOrderSchema.parse(payload);
    await this.validateOrderInput(companyId, body);
    const normalized = this.normalizeLines(body.lines);
    const totalRevenue = normalized.reduce((sum, line) => sum + line.lineTotal, 0);

    const row = await this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          companyId,
          orderNo: body.orderNo ?? null,
          orderDate: this.parseDateValue(body.orderDate, false),
          profitCenterId: body.profitCenterId ?? null,
          warehouseId: body.warehouseId ?? null,
          currency: body.currency,
          notes: body.notes ?? null,
          totalRevenue: new Prisma.Decimal(totalRevenue),
          totalCogs: new Prisma.Decimal(0),
          createdByUserId: actorUserId
        }
      });

      for (const line of normalized) {
        await tx.salesOrderLine.create({
          data: {
            companyId,
            salesOrderId: order.id,
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            lineTotal: new Prisma.Decimal(line.lineTotal)
          }
        });
      }

      return tx.salesOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          warehouse: true,
          profitCenter: true,
          lines: { include: { product: true }, orderBy: { createdAt: 'asc' } }
        }
      });
    });

    await this.logCompany(actorUserId, companyId, 'company.sales.order.create', 'sales_order', row.id, body, ip, userAgent);
    return row;
  }

  async getOrder(companyId: string, id: string) {
    return this.requireOrder(companyId, id);
  }

  async updateOrder(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = salesOrderSchema.partial().parse(payload);
    const existing = await this.requireOrder(companyId, id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only draft orders can be edited');
    }

    if (body.profitCenterId) await this.requireProfitCenter(companyId, body.profitCenterId);
    if (body.warehouseId) await this.requireWarehouse(companyId, body.warehouseId);
    if (body.lines) {
      for (const line of body.lines) {
        await this.requireProduct(companyId, line.productId);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id: existing.id },
        data: {
          ...(body.orderNo !== undefined ? { orderNo: body.orderNo } : {}),
          ...(body.orderDate !== undefined ? { orderDate: this.parseDateValue(body.orderDate, false) } : {}),
          ...(body.profitCenterId !== undefined ? { profitCenterId: body.profitCenterId } : {}),
          ...(body.warehouseId !== undefined ? { warehouseId: body.warehouseId } : {}),
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {})
        }
      });

      if (body.lines) {
        const normalized = this.normalizeLines(body.lines);
        const totalRevenue = normalized.reduce((sum, line) => sum + line.lineTotal, 0);
        await tx.salesOrderLine.deleteMany({ where: { salesOrderId: existing.id } });
        for (const line of normalized) {
          await tx.salesOrderLine.create({
            data: {
              companyId,
              salesOrderId: existing.id,
              productId: line.productId,
              quantity: new Prisma.Decimal(line.quantity),
              unitPrice: new Prisma.Decimal(line.unitPrice),
              lineTotal: new Prisma.Decimal(line.lineTotal)
            }
          });
        }
        await tx.salesOrder.update({
          where: { id: existing.id },
          data: { totalRevenue: new Prisma.Decimal(totalRevenue) }
        });
      }

      return tx.salesOrder.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          warehouse: true,
          profitCenter: true,
          lines: { include: { product: true }, orderBy: { createdAt: 'asc' } }
        }
      });
    });

    await this.logCompany(actorUserId, companyId, 'company.sales.order.update', 'sales_order', updated.id, body, ip, userAgent);
    return updated;
  }

  async postOrder(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireOrder(companyId, id);
    if (existing.status === 'POSTED') throw new BadRequestException('Order already posted');
    if (existing.status === 'VOID') throw new BadRequestException('Void order cannot be posted');
    if (!existing.warehouseId) throw new BadRequestException('Warehouse is required for posting');
    const warehouse = await this.requireWarehouse(companyId, existing.warehouseId);
    if (!warehouse.isActive) throw new BadRequestException('Warehouse is inactive');

    const lines = await this.prisma.salesOrderLine.findMany({
      where: { salesOrderId: existing.id },
      include: { product: true }
    });
    if (lines.length === 0) throw new BadRequestException('Order has no lines');

    const recipes = await this.prisma.recipe.findMany({
      where: { companyId, productId: { in: lines.map((line) => line.productId) } },
      include: { lines: { include: { item: true } } }
    });
    const recipeByProduct = new Map(recipes.map((row) => [row.productId, row]));

    const requiredByItem = new Map<string, number>();
    let totalRevenue = 0;
    let totalCogs = 0;
    const ingredientRows: Array<{ itemId: string; quantity: number; unitCost: number }> = [];

    for (const line of lines) {
      totalRevenue += Number(line.lineTotal);
      const recipe = recipeByProduct.get(line.productId);
      if (!recipe) throw new BadRequestException(`Recipe missing for product: ${line.product.name}`);

      const yieldQty = Number(recipe.yieldQuantity);
      if (yieldQty <= 0) throw new BadRequestException(`Recipe has invalid yield for product: ${line.product.name}`);

      const scale = Number(line.quantity) / yieldQty;
      for (const recipeLine of recipe.lines) {
        const qty = Number(recipeLine.quantity) * scale;
        const prev = requiredByItem.get(recipeLine.itemId) ?? 0;
        requiredByItem.set(recipeLine.itemId, prev + qty);
        const unitCost = recipeLine.item.lastPurchaseUnitCost ? Number(recipeLine.item.lastPurchaseUnitCost) : 0;
        const cogsPart = qty * unitCost;
        totalCogs += cogsPart;
        ingredientRows.push({
          itemId: recipeLine.itemId,
          quantity: qty,
          unitCost
        });
      }
    }

    for (const [itemId, qty] of requiredByItem.entries()) {
      const available = await this.currentStock(companyId, itemId, existing.warehouseId);
      if (available < qty - 0.0001) {
        const item = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
        throw new BadRequestException(`Insufficient stock for ${item?.name ?? itemId}. Required=${qty.toFixed(4)}, available=${available.toFixed(4)}`);
      }
    }

    const revenueCategory = await this.getOrCreateCategory(companyId, 'Sales Revenue', 'INCOME');
    const cogsCategory = await this.getOrCreateCategory(companyId, 'COGS', 'EXPENSE');

    const result = await this.prisma.$transaction(async (tx) => {
      const movementIds: string[] = [];
      for (const row of ingredientRows) {
        const movement = await tx.inventoryStockMovement.create({
          data: {
            companyId,
            itemId: row.itemId,
            warehouseId: existing.warehouseId!,
            type: 'OUT',
            quantity: new Prisma.Decimal(row.quantity),
            reference: existing.orderNo ?? `SALE-${existing.id.slice(0, 8)}`,
            relatedDocumentType: 'sale',
            relatedDocumentId: existing.id,
            createdByUserId: actorUserId
          }
        });
        movementIds.push(movement.id);
      }

      const revenueEntry = await tx.financeEntry.create({
        data: {
          companyId,
          categoryId: revenueCategory.id,
          amount: new Prisma.Decimal(totalRevenue),
          date: existing.orderDate,
          description: `Sales revenue for order ${existing.orderNo ?? existing.id}`,
          reference: existing.orderNo ?? null,
          profitCenterId: existing.profitCenterId,
          relatedDocumentType: 'sale',
          relatedDocumentId: existing.id,
          createdByUserId: actorUserId
        }
      });

      const cogsEntry = await tx.financeEntry.create({
        data: {
          companyId,
          categoryId: cogsCategory.id,
          amount: new Prisma.Decimal(totalCogs),
          date: existing.orderDate,
          description: `COGS for order ${existing.orderNo ?? existing.id}`,
          reference: existing.orderNo ?? null,
          profitCenterId: existing.profitCenterId,
          relatedDocumentType: 'sale',
          relatedDocumentId: existing.id,
          createdByUserId: actorUserId
        }
      });

      const order = await tx.salesOrder.update({
        where: { id: existing.id },
        data: {
          status: 'POSTED',
          totalRevenue: new Prisma.Decimal(totalRevenue),
          totalCogs: new Prisma.Decimal(totalCogs)
        }
      });

      return {
        order,
        movementIds,
        financeEntryIds: [revenueEntry.id, cogsEntry.id]
      };
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.sales.order.post',
      'sales_order',
      existing.id,
      {
        totalRevenue,
        totalCogs,
        movementCount: result.movementIds.length,
        financeEntryIds: result.financeEntryIds
      },
      ip,
      userAgent
    );

    return result;
  }

  async voidOrder(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireOrder(companyId, id);
    if (existing.status === 'VOID') throw new BadRequestException('Order already void');

    if (existing.status === 'DRAFT') {
      const row = await this.prisma.salesOrder.update({
        where: { id: existing.id },
        data: { status: 'VOID' }
      });
      await this.logCompany(actorUserId, companyId, 'company.sales.order.void', 'sales_order', existing.id, { mode: 'draft' }, ip, userAgent);
      return row;
    }

    if (!existing.warehouseId) throw new BadRequestException('Posted order is missing warehouse');
    const saleMovements = await this.prisma.inventoryStockMovement.findMany({
      where: {
        companyId,
        relatedDocumentType: 'sale',
        relatedDocumentId: existing.id,
        type: 'OUT'
      }
    });
    const saleFinanceEntries = await this.prisma.financeEntry.findMany({
      where: {
        companyId,
        relatedDocumentType: 'sale',
        relatedDocumentId: existing.id
      }
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const reversalMovementIds: string[] = [];
      for (const move of saleMovements) {
        const reversal = await tx.inventoryStockMovement.create({
          data: {
            companyId,
            itemId: move.itemId,
            warehouseId: move.warehouseId,
            type: 'IN',
            quantity: move.quantity,
            reference: `VOID-${existing.orderNo ?? existing.id.slice(0, 8)}`,
            relatedDocumentType: 'sale_void',
            relatedDocumentId: existing.id,
            createdByUserId: actorUserId
          }
        });
        reversalMovementIds.push(reversal.id);
      }

      const reversalFinanceIds: string[] = [];
      for (const entry of saleFinanceEntries) {
        const reverse = await tx.financeEntry.create({
          data: {
            companyId,
            categoryId: entry.categoryId,
            amount: new Prisma.Decimal(-Number(entry.amount)),
            date: new Date(),
            description: `Reversal of sale order ${existing.orderNo ?? existing.id}`,
            reference: existing.orderNo ?? null,
            profitCenterId: entry.profitCenterId,
            relatedDocumentType: 'sale_void',
            relatedDocumentId: existing.id,
            createdByUserId: actorUserId
          }
        });
        reversalFinanceIds.push(reverse.id);
      }

      const order = await tx.salesOrder.update({
        where: { id: existing.id },
        data: { status: 'VOID' }
      });

      return { order, reversalMovementIds, reversalFinanceIds };
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.sales.order.void',
      'sales_order',
      existing.id,
      {
        mode: 'posted_reversal',
        reversalMovementCount: result.reversalMovementIds.length,
        reversalFinanceEntryIds: result.reversalFinanceIds
      },
      ip,
      userAgent
    );

    return result;
  }

  private normalizeLines(lines: Array<{ productId: string; quantity: number; unitPrice: number }>) {
    return lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.quantity) * Number(line.unitPrice)
    }));
  }

  private async validateOrderInput(
    companyId: string,
    body: {
      profitCenterId?: string | null;
      warehouseId?: string | null;
      lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
    }
  ) {
    if (body.profitCenterId) await this.requireProfitCenter(companyId, body.profitCenterId);
    if (body.warehouseId) await this.requireWarehouse(companyId, body.warehouseId);
    for (const line of body.lines) {
      await this.requireProduct(companyId, line.productId);
    }
  }

  private async requireOrder(companyId: string, id: string) {
    const row = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        warehouse: true,
        profitCenter: true,
        lines: { include: { product: true }, orderBy: { createdAt: 'asc' } }
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Sales order not found');
    }
    return row;
  }

  private async requireProduct(companyId: string, id: string) {
    const row = await this.prisma.salesProduct.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Product not found');
    }
    return row;
  }

  private async requireWarehouse(companyId: string, id: string) {
    const row = await this.prisma.inventoryWarehouse.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Warehouse not found');
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

  private parseDateValue(raw: string, endOfDay = false) {
    const dateText = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : raw;
    const value = new Date(dateText);
    if (Number.isNaN(value.valueOf())) {
      throw new BadRequestException('Invalid date value');
    }
    return value;
  }

  private toStockDelta(type: InventoryMovementType, quantity: number) {
    if (type === 'IN' || type === 'TRANSFER_IN') return quantity;
    if (type === 'OUT' || type === 'TRANSFER_OUT') return -quantity;
    return quantity;
  }

  private async currentStock(companyId: string, itemId: string, warehouseId: string) {
    const rows = await this.prisma.inventoryStockMovement.findMany({
      where: { companyId, itemId, warehouseId },
      select: { type: true, quantity: true }
    });

    let total = 0;
    for (const row of rows) {
      total += this.toStockDelta(row.type, Number(row.quantity));
    }
    return total;
  }

  private async getOrCreateCategory(companyId: string, name: string, type: 'INCOME' | 'EXPENSE') {
    const existing = await this.prisma.financeCategory.findFirst({
      where: { companyId, name, type }
    });
    if (existing) return existing;
    return this.prisma.financeCategory.create({
      data: {
        companyId,
        name,
        type
      }
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
