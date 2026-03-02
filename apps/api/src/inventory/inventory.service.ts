import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InventoryMovementType } from '@prisma/client';
import {
  inventoryItemSchema,
  inventoryItemCostSchema,
  inventoryMovementQuerySchema,
  inventoryMovementSchema,
  inventoryStockBalanceQuerySchema,
  inventoryTransferSchema,
  inventoryWarehouseSchema
} from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

@Injectable()
export class InventoryService {
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
      manageItem: keys.has('module:inventory-core.item.manage'),
      manageItemCost: keys.has('module:inventory-core.item.cost.manage'),
      manageWarehouse: keys.has('module:inventory-core.warehouse.manage'),
      manageMovement: keys.has('module:inventory-core.movement.manage'),
      readMovement: keys.has('module:inventory-core.movement.read')
    };
  }

  listWarehouses(companyId: string) {
    return this.prisma.inventoryWarehouse.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
  }

  async createWarehouse(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryWarehouseSchema.parse(payload);
    const row = await this.prisma.inventoryWarehouse.create({
      data: {
        companyId,
        name: body.name,
        location: body.location ?? null,
        isActive: body.isActive ?? true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.warehouse.create', 'inventory_warehouse', row.id, body, ip, userAgent);
    return row;
  }

  async updateWarehouse(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryWarehouseSchema.partial().parse(payload);
    const existing = await this.requireWarehouse(companyId, id);

    const row = await this.prisma.inventoryWarehouse.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.location !== undefined ? { location: body.location } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.warehouse.update', 'inventory_warehouse', row.id, body, ip, userAgent);
    return row;
  }

  listItems(companyId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
  }

  async createItem(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemSchema.parse(payload);
    const row = await this.prisma.inventoryItem.create({
      data: {
        companyId,
        name: body.name,
        sku: body.sku ?? null,
        unit: body.unit,
        isActive: body.isActive ?? true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.item.create', 'inventory_item', row.id, body, ip, userAgent);
    return row;
  }

  async updateItem(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemSchema.partial().parse(payload);
    const existing = await this.requireItem(companyId, id);

    const row = await this.prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.item.update', 'inventory_item', row.id, body, ip, userAgent);
    return row;
  }

  async updateItemCost(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemCostSchema.parse(payload);
    const existing = await this.requireItem(companyId, id);

    const row = await this.prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        lastPurchaseUnitCost: body.lastPurchaseUnitCost === null ? null : new Prisma.Decimal(body.lastPurchaseUnitCost)
      }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.item.cost.update',
      'inventory_item',
      row.id,
      { lastPurchaseUnitCost: body.lastPurchaseUnitCost },
      ip,
      userAgent
    );

    return row;
  }

  async listMovements(companyId: string, query: unknown) {
    const parsed = inventoryMovementQuerySchema.parse(query);

    return this.prisma.inventoryStockMovement.findMany({
      where: {
        companyId,
        ...(parsed.itemId ? { itemId: parsed.itemId } : {}),
        ...(parsed.warehouseId ? { warehouseId: parsed.warehouseId } : {}),
        ...(parsed.from || parsed.to
          ? {
              createdAt: {
                ...(parsed.from ? { gte: this.parseDateValue(parsed.from, false) } : {}),
                ...(parsed.to ? { lte: this.parseDateValue(parsed.to, true) } : {})
              }
            }
          : {})
      },
      include: { item: true, warehouse: true, createdByUser: true },
      orderBy: [{ createdAt: 'desc' }]
    });
  }

  async createMovement(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryMovementSchema.parse(payload);
    const item = await this.requireItem(companyId, body.itemId);
    const warehouse = await this.requireWarehouse(companyId, body.warehouseId);

    if (!item.isActive) throw new BadRequestException('Item is inactive');
    if (!warehouse.isActive) throw new BadRequestException('Warehouse is inactive');

    let movementType: InventoryMovementType;
    let quantityValue: number;

    if (body.type === 'IN') {
      if (body.quantity <= 0) throw new BadRequestException('IN movement requires positive quantity');
      movementType = 'IN';
      quantityValue = body.quantity;
    } else if (body.type === 'OUT') {
      if (body.quantity <= 0) throw new BadRequestException('OUT movement requires positive quantity');
      await this.assertStockAvailable(companyId, body.itemId, body.warehouseId, body.quantity);
      movementType = 'OUT';
      quantityValue = body.quantity;
    } else {
      movementType = 'ADJUSTMENT';
      quantityValue = body.quantity;
      if (quantityValue < 0) {
        await this.assertStockAvailable(companyId, body.itemId, body.warehouseId, Math.abs(quantityValue));
      }
    }

    const row = await this.prisma.inventoryStockMovement.create({
      data: {
        companyId,
        itemId: body.itemId,
        warehouseId: body.warehouseId,
        type: movementType,
        quantity: new Prisma.Decimal(quantityValue),
        reference: body.reference ?? null,
        relatedDocumentType: body.relatedDocumentType ?? 'manual',
        relatedDocumentId: body.relatedDocumentId ?? null,
        createdByUserId: actorUserId
      },
      include: { item: true, warehouse: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.movement.create',
      'inventory_stock_movement',
      row.id,
      {
        itemId: row.itemId,
        warehouseId: row.warehouseId,
        type: row.type,
        quantity: Number(row.quantity)
      },
      ip,
      userAgent
    );

    return row;
  }

  async transfer(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryTransferSchema.parse(payload);
    if (body.fromWarehouseId === body.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must differ');
    }

    const item = await this.requireItem(companyId, body.itemId);
    const fromWarehouse = await this.requireWarehouse(companyId, body.fromWarehouseId);
    const toWarehouse = await this.requireWarehouse(companyId, body.toWarehouseId);

    if (!item.isActive) throw new BadRequestException('Item is inactive');
    if (!fromWarehouse.isActive || !toWarehouse.isActive) throw new BadRequestException('Warehouse is inactive');

    await this.assertStockAvailable(companyId, body.itemId, body.fromWarehouseId, body.quantity);

    const transferRef = body.reference ?? `TR-${Date.now()}`;
    const [outRow, inRow] = await this.prisma.$transaction([
      this.prisma.inventoryStockMovement.create({
        data: {
          companyId,
          itemId: body.itemId,
          warehouseId: body.fromWarehouseId,
          type: 'TRANSFER_OUT',
          quantity: new Prisma.Decimal(body.quantity),
          reference: transferRef,
          relatedDocumentType: 'transfer',
          relatedDocumentId: transferRef,
          createdByUserId: actorUserId
        }
      }),
      this.prisma.inventoryStockMovement.create({
        data: {
          companyId,
          itemId: body.itemId,
          warehouseId: body.toWarehouseId,
          type: 'TRANSFER_IN',
          quantity: new Prisma.Decimal(body.quantity),
          reference: transferRef,
          relatedDocumentType: 'transfer',
          relatedDocumentId: transferRef,
          createdByUserId: actorUserId
        }
      })
    ]);

    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.transfer',
      'inventory_stock_movement',
      outRow.id,
      {
        itemId: body.itemId,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        quantity: body.quantity,
        reference: transferRef,
        outMovementId: outRow.id,
        inMovementId: inRow.id
      },
      ip,
      userAgent
    );

    return { outMovement: outRow, inMovement: inRow };
  }

  async stockBalance(companyId: string, query: unknown) {
    const parsed = inventoryStockBalanceQuerySchema.parse(query);

    if (parsed.itemId) await this.requireItem(companyId, parsed.itemId);
    if (parsed.warehouseId) await this.requireWarehouse(companyId, parsed.warehouseId);

    const movements = await this.prisma.inventoryStockMovement.findMany({
      where: {
        companyId,
        ...(parsed.itemId ? { itemId: parsed.itemId } : {}),
        ...(parsed.warehouseId ? { warehouseId: parsed.warehouseId } : {})
      },
      include: { item: true, warehouse: true }
    });

    const map = new Map<string, { itemId: string; itemName: string; unit: string; warehouseId: string; warehouseName: string; quantity: number }>();

    for (const movement of movements) {
      const key = `${movement.itemId}:${movement.warehouseId}`;
      const existing =
        map.get(key) ??
        {
          itemId: movement.itemId,
          itemName: movement.item.name,
          unit: movement.item.unit,
          warehouseId: movement.warehouseId,
          warehouseName: movement.warehouse.name,
          quantity: 0
        };

      existing.quantity += this.toStockDelta(movement.type, Number(movement.quantity));
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName) || a.warehouseName.localeCompare(b.warehouseName));
  }

  private toStockDelta(type: InventoryMovementType, quantity: number) {
    if (type === 'IN' || type === 'TRANSFER_IN') return quantity;
    if (type === 'OUT' || type === 'TRANSFER_OUT') return -quantity;
    return quantity;
  }

  private async assertStockAvailable(companyId: string, itemId: string, warehouseId: string, required: number) {
    const current = await this.currentStock(companyId, itemId, warehouseId);
    if (current < required - 0.0001) {
      throw new BadRequestException(`Insufficient stock. Available: ${current.toFixed(4)}`);
    }
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

  private async requireWarehouse(companyId: string, id: string) {
    const row = await this.prisma.inventoryWarehouse.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Warehouse not found');
    }
    return row;
  }

  private async requireItem(companyId: string, id: string) {
    const row = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Item not found');
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
