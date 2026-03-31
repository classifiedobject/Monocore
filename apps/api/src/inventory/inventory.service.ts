import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InventoryMovementType } from '@prisma/client';
import {
  inventoryBrandSchema,
  inventoryBrandSupplierLinkSchema,
  inventoryItemBulkExportSchema,
  inventoryItemBulkStatusSchema,
  inventoryItemListQuerySchema,
  inventoryItemSchema,
  inventoryItemSavedViewSchema,
  inventoryItemSavedViewUpdateSchema,
  inventoryItemUpdateSchema,
  inventoryItemCostSchema,
  inventoryMovementQuerySchema,
  inventoryMovementSchema,
  inventoryStockBalanceQuerySchema,
  inventoryStockCountLineUpsertSchema,
  inventoryStockCountSessionSchema,
  inventorySupplierSchema,
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
      manageItem: keys.has('module:inventory-core.items.manage') || keys.has('module:inventory-core.item.manage'),
      manageItemCost: keys.has('module:inventory-core.items.manage') || keys.has('module:inventory-core.item.cost.manage'),
      readItems: keys.has('module:inventory-core.items.read') || keys.has('module:inventory-core.movement.read'),
      manageWarehouse: keys.has('module:inventory-core.warehouse.manage'),
      manageMovement: keys.has('module:inventory-core.movement.manage'),
      readMovement: keys.has('module:inventory-core.movement.read'),
      manageStockCount: keys.has('module:inventory-core.stock-count.manage'),
      readStockCount: keys.has('module:inventory-core.stock-count.read'),
      manageSuppliers: keys.has('module:inventory-core.suppliers.manage'),
      readSuppliers: keys.has('module:inventory-core.suppliers.read'),
      manageBrands: keys.has('module:inventory-core.brands.manage'),
      readBrands: keys.has('module:inventory-core.brands.read')
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

  async listItems(companyId: string, query?: unknown) {
    const parsed = inventoryItemListQuerySchema.parse(query ?? {});
    const page = parsed.page ?? 1;
    const pageSize = parsed.pageSize ?? 50;
    const search = parsed.search?.trim();
    const where: Prisma.InventoryItemWhereInput = {
      companyId,
      ...(parsed.brandId ? { brandId: parsed.brandId } : {}),
      ...(parsed.status === 'active' ? { isActive: true } : {}),
      ...(parsed.status === 'inactive' ? { isActive: false } : {}),
      ...(parsed.mainStockArea ? { mainStockArea: parsed.mainStockArea } : {}),
      ...(parsed.attributeCategory ? { attributeCategory: parsed.attributeCategory } : {}),
      ...(parsed.subCategory ? { subCategory: { contains: parsed.subCategory, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { subCategory: { contains: search, mode: 'insensitive' } },
              { mainStockArea: { equals: this.normalizeMainStockAreaSearch(search) ?? undefined } },
              { attributeCategory: { equals: this.normalizeAttributeCategorySearch(search) ?? undefined } },
              { brand: { name: { contains: search, mode: 'insensitive' } } },
              { supplier: { shortName: { contains: search, mode: 'insensitive' } } }
            ].filter(Boolean) as Prisma.InventoryItemWhereInput[]
          }
        : {})
    };

    const orderBy = this.itemOrderBy(parsed.sortBy ?? null, parsed.sortDirection ?? null);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        include: { brand: true, supplier: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  }

  async bulkSetItemStatus(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemBulkStatusSchema.parse(payload);
    const rows = await this.prisma.inventoryItem.findMany({
      where: { companyId, id: { in: body.ids } },
      select: { id: true }
    });
    const foundIds = new Set(rows.map((row) => row.id));
    const missingIds = body.ids.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      await this.logCompany(
        actorUserId,
        companyId,
        body.isActive ? 'company.inventory.item.bulk_activate' : 'company.inventory.item.bulk_deactivate',
        'inventory_item',
        undefined,
        { status: 'failed', reason: 'missing_items', missingIds, count: body.ids.length, isActive: body.isActive },
        ip,
        userAgent
      );
      throw new NotFoundException('Some selected items could not be found.');
    }

    await this.prisma.inventoryItem.updateMany({
      where: { companyId, id: { in: body.ids } },
      data: { isActive: body.isActive }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      body.isActive ? 'company.inventory.item.bulk_activate' : 'company.inventory.item.bulk_deactivate',
      'inventory_item',
      undefined,
      { status: 'success', ids: body.ids, count: body.ids.length, isActive: body.isActive },
      ip,
      userAgent
    );

    return { ok: true, count: body.ids.length, isActive: body.isActive };
  }

  async bulkExportItems(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemBulkExportSchema.parse(payload);
    const rows = await this.prisma.inventoryItem.findMany({
      where: { companyId, id: { in: body.ids } },
      include: { brand: true, supplier: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    if (rows.length === 0) {
      throw new NotFoundException('No inventory items found for export.');
    }

    const exportRows = rows.map((row) => ({
      'Ürün Adı': row.name,
      'Ana Firma': row.brand?.name ?? '-',
      'Distribütör': row.supplier?.shortName ?? '-',
      'Ana Stok': row.mainStockArea,
      'Nitelik': row.attributeCategory,
      'Takip Birimi': row.baseUom.toLowerCase(),
      Paket: row.packageUom ? `${row.packageUom} (${row.packageSizeBase ?? '-'})` : '-',
      'Alış KDV %': this.percentString(row.purchaseVatRate),
      'Liste Fiyatı': this.moneyString(row.listPriceExVat),
      'İskonto %': this.percentString(row.discountRate),
      'Net Alış (KDV Dahil)': this.moneyString(row.computedPriceIncVat),
      Durum: row.isActive ? 'Aktif' : 'Pasif'
    }));

    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.item.bulk_export',
      'inventory_item',
      undefined,
      { status: 'success', ids: body.ids, count: body.ids.length, format: body.format },
      ip,
      userAgent
    );

    if (body.format === 'csv') {
      return {
        filename: 'inventory-items-selected.csv',
        contentType: 'text/csv; charset=utf-8',
        buffer: Buffer.from(this.toCsv(exportRows), 'utf-8')
      };
    }

    return {
      filename: 'inventory-items-selected.xls',
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      buffer: Buffer.from(this.toExcelXml('Inventory Items', exportRows), 'utf-8')
    };
  }

  listItemSavedViews(companyId: string) {
    return this.prisma.inventoryItemSavedView.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });
  }

  async createItemSavedView(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemSavedViewSchema.parse(payload);
    const row = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.inventoryItemSavedView.updateMany({
          where: { companyId, isDefault: true },
          data: { isDefault: false }
        });
      }
      return tx.inventoryItemSavedView.create({
        data: {
          companyId,
          name: body.name,
          isDefault: body.isDefault ?? false,
          filtersJson: (body.filtersJson ?? {}) as Prisma.InputJsonValue,
          searchQuery: body.searchQuery ?? null,
          sortBy: body.sortBy ?? null,
          sortDirection: body.sortDirection ?? null,
          pageSize: body.pageSize ?? null,
          createdByUserId: actorUserId
        }
      });
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.item_saved_view.create', 'inventory_item_saved_view', row.id, body, ip, userAgent);
    return row;
  }

  async updateItemSavedView(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemSavedViewUpdateSchema.parse(payload);
    const existing = await this.requireItemSavedView(companyId, id);
    const row = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.inventoryItemSavedView.updateMany({
          where: { companyId, isDefault: true, NOT: { id: existing.id } },
          data: { isDefault: false }
        });
      }

      return tx.inventoryItemSavedView.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          ...(body.filtersJson !== undefined ? { filtersJson: body.filtersJson as Prisma.InputJsonValue } : {}),
          ...(body.searchQuery !== undefined ? { searchQuery: body.searchQuery ?? null } : {}),
          ...(body.sortBy !== undefined ? { sortBy: body.sortBy ?? null } : {}),
          ...(body.sortDirection !== undefined ? { sortDirection: body.sortDirection ?? null } : {}),
          ...(body.pageSize !== undefined ? { pageSize: body.pageSize ?? null } : {})
        }
      });
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.item_saved_view.update', 'inventory_item_saved_view', row.id, body, ip, userAgent);
    return row;
  }

  async deleteItemSavedView(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireItemSavedView(companyId, id);
    await this.prisma.inventoryItemSavedView.delete({ where: { id: existing.id } });
    await this.logCompany(actorUserId, companyId, 'company.inventory.item_saved_view.delete', 'inventory_item_saved_view', existing.id, { name: existing.name }, ip, userAgent);
    return { ok: true };
  }

  async setDefaultItemSavedView(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireItemSavedView(companyId, id);
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItemSavedView.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false }
      });
      return tx.inventoryItemSavedView.update({
        where: { id: existing.id },
        data: { isDefault: true }
      });
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.item_saved_view.set_default', 'inventory_item_saved_view', row.id, { name: row.name }, ip, userAgent);
    return row;
  }

  async createItem(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemSchema.parse(payload);
    const mappedBaseUom = this.unitToBaseUom(body.unit);
    const finalBaseUom = body.baseUom === 'PIECE' && mappedBaseUom !== 'PIECE' ? mappedBaseUom : body.baseUom;
    if (body.brandId) await this.requireBrand(companyId, body.brandId);
    if (body.supplierId) await this.requireSupplier(companyId, body.supplierId);
    const computedPriceIncVat = this.computePriceIncVat(body.listPriceExVat ?? null, body.discountRate ?? 0, body.purchaseVatRate ?? 0.2);
    const row = await this.prisma.inventoryItem.create({
      data: {
        companyId,
        name: body.name,
        sku: body.sku ?? null,
        unit: finalBaseUom.toLowerCase(),
        brandId: body.brandId ?? null,
        supplierId: body.supplierId ?? null,
        mainStockArea: body.mainStockArea ?? 'OTHER',
        attributeCategory: body.attributeCategory ?? 'OTHER',
        subCategory: body.subCategory ?? null,
        baseUom: finalBaseUom,
        packageUom: body.packageUom ?? null,
        packageSizeBase: body.packageSizeBase === undefined || body.packageSizeBase === null ? null : new Prisma.Decimal(body.packageSizeBase),
        purchaseVatRate: new Prisma.Decimal(body.purchaseVatRate ?? 0.2),
        listPriceExVat: body.listPriceExVat === undefined || body.listPriceExVat === null ? null : new Prisma.Decimal(body.listPriceExVat),
        discountRate: new Prisma.Decimal(body.discountRate ?? 0),
        computedPriceIncVat: computedPriceIncVat === null ? null : new Prisma.Decimal(computedPriceIncVat),
        lastPurchaseUnitCost:
          body.lastPurchaseUnitCost === undefined || body.lastPurchaseUnitCost === null
            ? computedPriceIncVat === null
              ? null
              : new Prisma.Decimal(computedPriceIncVat)
            : new Prisma.Decimal(body.lastPurchaseUnitCost),
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 1000
      },
      include: { brand: true, supplier: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.inventory.item.create', 'inventory_item', row.id, body, ip, userAgent);
    return row;
  }

  async updateItem(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryItemUpdateSchema.parse(payload);
    const existing = await this.requireItem(companyId, id);
    const baseUomFromUnit = body.unit !== undefined ? this.unitToBaseUom(body.unit) : undefined;
    const effectiveBaseUom = body.baseUom ?? baseUomFromUnit;
    const nextBrandId = body.brandId === undefined ? existing.brandId : body.brandId;
    const nextSupplierId = body.supplierId === undefined ? existing.supplierId : body.supplierId;
    const nextListPrice = body.listPriceExVat === undefined ? this.toNumberOrNull(existing.listPriceExVat) : body.listPriceExVat;
    const nextDiscount = body.discountRate === undefined ? Number(existing.discountRate) : body.discountRate;
    const nextVat = body.purchaseVatRate === undefined ? Number(existing.purchaseVatRate) : body.purchaseVatRate;
    if (nextBrandId) await this.requireBrand(companyId, nextBrandId);
    if (nextSupplierId) await this.requireSupplier(companyId, nextSupplierId);
    const computedPriceIncVat = this.computePriceIncVat(nextListPrice, nextDiscount, nextVat);

    const row = await this.prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.brandId !== undefined ? { brandId: body.brandId } : {}),
        ...(body.supplierId !== undefined ? { supplierId: body.supplierId } : {}),
        ...(body.mainStockArea !== undefined ? { mainStockArea: body.mainStockArea } : {}),
        ...(body.attributeCategory !== undefined ? { attributeCategory: body.attributeCategory } : {}),
        ...(body.subCategory !== undefined ? { subCategory: body.subCategory } : {}),
        ...(effectiveBaseUom !== undefined ? { baseUom: effectiveBaseUom, unit: effectiveBaseUom.toLowerCase() } : {}),
        ...(body.packageUom !== undefined ? { packageUom: body.packageUom } : {}),
        ...(body.packageSizeBase !== undefined
          ? { packageSizeBase: body.packageSizeBase === null ? null : new Prisma.Decimal(body.packageSizeBase) }
          : {}),
        ...(body.purchaseVatRate !== undefined ? { purchaseVatRate: new Prisma.Decimal(body.purchaseVatRate) } : {}),
        ...(body.listPriceExVat !== undefined
          ? { listPriceExVat: body.listPriceExVat === null ? null : new Prisma.Decimal(body.listPriceExVat) }
          : {}),
        ...(body.discountRate !== undefined ? { discountRate: new Prisma.Decimal(body.discountRate) } : {}),
        computedPriceIncVat: computedPriceIncVat === null ? null : new Prisma.Decimal(computedPriceIncVat),
        ...(body.lastPurchaseUnitCost !== undefined
          ? { lastPurchaseUnitCost: body.lastPurchaseUnitCost === null ? null : new Prisma.Decimal(body.lastPurchaseUnitCost) }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
      },
      include: { brand: true, supplier: true }
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

  async activateItem(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setItemActive(actorUserId, companyId, id, true, ip, userAgent);
  }

  async deactivateItem(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setItemActive(actorUserId, companyId, id, false, ip, userAgent);
  }

  listSuppliers(companyId: string) {
    return this.prisma.inventorySupplier.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { shortName: 'asc' }]
    });
  }

  async createSupplier(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventorySupplierSchema.parse(payload);
    const row = await this.prisma.inventorySupplier.create({
      data: {
        companyId,
        shortName: body.shortName,
        legalName: body.legalName,
        address: body.address ?? null,
        taxOffice: body.taxOffice ?? null,
        taxNumber: body.taxNumber ?? null,
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        notes: body.notes ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 1000
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.inventory.supplier.create', 'inventory_supplier', row.id, body, ip, userAgent);
    return row;
  }

  async updateSupplier(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventorySupplierSchema.partial().parse(payload);
    const existing = await this.requireSupplier(companyId, id);
    const row = await this.prisma.inventorySupplier.update({
      where: { id: existing.id },
      data: {
        ...(body.shortName !== undefined ? { shortName: body.shortName } : {}),
        ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.taxOffice !== undefined ? { taxOffice: body.taxOffice } : {}),
        ...(body.taxNumber !== undefined ? { taxNumber: body.taxNumber } : {}),
        ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
        ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.inventory.supplier.update', 'inventory_supplier', row.id, body, ip, userAgent);
    return row;
  }

  async activateSupplier(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setSupplierActive(actorUserId, companyId, id, true, ip, userAgent);
  }

  async deactivateSupplier(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setSupplierActive(actorUserId, companyId, id, false, ip, userAgent);
  }

  async deleteSupplier(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireSupplier(companyId, id);
    try {
      const links = await this.prisma.inventoryBrandSupplier.count({ where: { companyId, supplierId: existing.id } });
      if (links > 0) {
        throw new ConflictException('Supplier is linked to brands and cannot be deleted. Deactivate instead.');
      }
      await this.prisma.inventorySupplier.delete({ where: { id: existing.id } });
      await this.logCompany(actorUserId, companyId, 'company.inventory.supplier.delete', 'inventory_supplier', existing.id, { status: 'success' }, ip, userAgent);
      return { ok: true };
    } catch (error) {
      await this.logCompany(
        actorUserId,
        companyId,
        'company.inventory.supplier.delete',
        'inventory_supplier',
        existing.id,
        { status: 'failed', reason: error instanceof Error ? error.message : 'unknown' },
        ip,
        userAgent
      );
      throw error;
    }
  }

  listBrands(companyId: string) {
    return this.prisma.inventoryBrand.findMany({
      where: { companyId },
      include: {
        supplierLinks: {
          include: { supplier: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async createBrand(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryBrandSchema.parse(payload);
    const row = await this.prisma.inventoryBrand.create({
      data: {
        companyId,
        name: body.name,
        shortName: body.shortName ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 1000
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.inventory.brand.create', 'inventory_brand', row.id, body, ip, userAgent);
    return row;
  }

  async updateBrand(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryBrandSchema.partial().parse(payload);
    const existing = await this.requireBrand(companyId, id);
    const row = await this.prisma.inventoryBrand.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.shortName !== undefined ? { shortName: body.shortName } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.inventory.brand.update', 'inventory_brand', row.id, body, ip, userAgent);
    return row;
  }

  async activateBrand(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setBrandActive(actorUserId, companyId, id, true, ip, userAgent);
  }

  async deactivateBrand(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setBrandActive(actorUserId, companyId, id, false, ip, userAgent);
  }

  async deleteBrand(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireBrand(companyId, id);
    try {
      const links = await this.prisma.inventoryBrandSupplier.count({ where: { companyId, brandId: existing.id } });
      if (links > 0) {
        throw new ConflictException('Brand is linked to suppliers and cannot be deleted. Deactivate instead.');
      }
      await this.prisma.inventoryBrand.delete({ where: { id: existing.id } });
      await this.logCompany(actorUserId, companyId, 'company.inventory.brand.delete', 'inventory_brand', existing.id, { status: 'success' }, ip, userAgent);
      return { ok: true };
    } catch (error) {
      await this.logCompany(
        actorUserId,
        companyId,
        'company.inventory.brand.delete',
        'inventory_brand',
        existing.id,
        { status: 'failed', reason: error instanceof Error ? error.message : 'unknown' },
        ip,
        userAgent
      );
      throw error;
    }
  }

  async linkBrandSupplier(actorUserId: string, companyId: string, brandId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryBrandSupplierLinkSchema.parse(payload);
    const brand = await this.requireBrand(companyId, brandId);
    const supplier = await this.requireSupplier(companyId, body.supplierId);

    const row = await this.prisma.inventoryBrandSupplier.upsert({
      where: {
        companyId_brandId_supplierId: {
          companyId,
          brandId: brand.id,
          supplierId: supplier.id
        }
      },
      create: {
        companyId,
        brandId: brand.id,
        supplierId: supplier.id
      },
      update: {}
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.brand_supplier.link',
      'inventory_brand_supplier',
      row.id,
      { brandId: brand.id, supplierId: supplier.id },
      ip,
      userAgent
    );
    return row;
  }

  async unlinkBrandSupplier(actorUserId: string, companyId: string, brandId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryBrandSupplierLinkSchema.parse(payload);
    const brand = await this.requireBrand(companyId, brandId);
    const supplier = await this.requireSupplier(companyId, body.supplierId);

    const existing = await this.prisma.inventoryBrandSupplier.findFirst({
      where: { companyId, brandId: brand.id, supplierId: supplier.id }
    });
    if (!existing) {
      throw new NotFoundException('Brand-supplier link not found');
    }

    await this.prisma.inventoryBrandSupplier.delete({ where: { id: existing.id } });
    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.brand_supplier.unlink',
      'inventory_brand_supplier',
      existing.id,
      { brandId: brand.id, supplierId: supplier.id },
      ip,
      userAgent
    );
    return { ok: true };
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

  listStockCounts(companyId: string) {
    return this.prisma.inventoryStockCountSession.findMany({
      where: { companyId },
      include: { warehouse: true, createdByUser: true, _count: { select: { lines: true } } },
      orderBy: [{ countDate: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createStockCountSession(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = inventoryStockCountSessionSchema.parse(payload);
    const warehouse = await this.requireWarehouse(companyId, body.warehouseId);
    if (!warehouse.isActive) {
      throw new BadRequestException('Warehouse is inactive');
    }

    try {
      const row = await this.prisma.inventoryStockCountSession.create({
        data: {
          companyId,
          warehouseId: body.warehouseId,
          countDate: this.parseDateValue(body.countDate, false),
          notes: body.notes ?? null,
          createdByUserId: actorUserId
        },
        include: { warehouse: true, createdByUser: true, lines: { include: { item: true } } }
      });

      await this.logCompany(
        actorUserId,
        companyId,
        'company.inventory.stock_count.create',
        'inventory_stock_count_session',
        row.id,
        body,
        ip,
        userAgent
      );
      return row;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Aynı depo ve tarih için zaten bir sayım oturumu var.');
      }
      throw error;
    }
  }

  async getStockCountSession(companyId: string, id: string) {
    const row = await this.prisma.inventoryStockCountSession.findUnique({
      where: { id },
      include: {
        warehouse: true,
        createdByUser: true,
        lines: {
          include: { item: true },
          orderBy: { item: { name: 'asc' } }
        }
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Stock count session not found');
    }
    return row;
  }

  async upsertStockCountLine(
    actorUserId: string,
    companyId: string,
    sessionId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = inventoryStockCountLineUpsertSchema.parse(payload);
    const session = await this.requireStockCountSession(companyId, sessionId);
    if (session.status !== 'DRAFT') {
      throw new ConflictException('Posted sessions cannot be edited');
    }

    const item = await this.requireItem(companyId, body.itemId);

    const packageSize = item.packageSizeBase ? Number(item.packageSizeBase) : null;
    const isPackageItem = Boolean(item.packageUom && packageSize && packageSize > 0);

    let countedQtyBase = body.countedQtyBase ?? null;
    let closedPackageQty = body.closedPackageQty ?? null;
    let openPackageCount = body.openPackageCount ?? null;
    let openQtyBase = body.openQtyBase ?? null;

    if (isPackageItem) {
      const closed = closedPackageQty ?? 0;
      const openCount = openPackageCount ?? 0;
      const openQty = openQtyBase ?? 0;
      if (openQty > openCount * (packageSize as number)) {
        throw new ConflictException('Açık toplam miktar, açık paket adedinin kapasitesinden büyük olamaz.');
      }
      countedQtyBase = closed * (packageSize as number) + openQty;
      closedPackageQty = closed;
      openPackageCount = openCount;
      openQtyBase = openQty;
    } else {
      if (countedQtyBase === null || countedQtyBase === undefined) {
        throw new BadRequestException('countedQtyBase is required for non-package items');
      }
      if (countedQtyBase < 0) {
        throw new BadRequestException('countedQtyBase cannot be negative');
      }
      closedPackageQty = null;
      openPackageCount = null;
      openQtyBase = null;
    }

    const row = await this.prisma.inventoryStockCountLine.upsert({
      where: {
        companyId_sessionId_itemId: {
          companyId,
          sessionId: session.id,
          itemId: item.id
        }
      },
      create: {
        companyId,
        sessionId: session.id,
        itemId: item.id,
        countedQtyBase: new Prisma.Decimal(countedQtyBase ?? 0),
        closedPackageQty,
        openPackageCount,
        openQtyBase: openQtyBase === null ? null : new Prisma.Decimal(openQtyBase)
      },
      update: {
        countedQtyBase: new Prisma.Decimal(countedQtyBase ?? 0),
        closedPackageQty,
        openPackageCount,
        openQtyBase: openQtyBase === null ? null : new Prisma.Decimal(openQtyBase)
      },
      include: { item: true }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.stock_count.line.upsert',
      'inventory_stock_count_line',
      row.id,
      {
        sessionId: session.id,
        itemId: item.id,
        countedQtyBase: Number(row.countedQtyBase),
        closedPackageQty: row.closedPackageQty,
        openPackageCount: row.openPackageCount,
        openQtyBase: row.openQtyBase ? Number(row.openQtyBase) : null
      },
      ip,
      userAgent
    );

    return row;
  }

  async deleteStockCountLine(
    actorUserId: string,
    companyId: string,
    sessionId: string,
    lineId: string,
    ip?: string,
    userAgent?: string
  ) {
    const session = await this.requireStockCountSession(companyId, sessionId);
    if (session.status !== 'DRAFT') {
      throw new ConflictException('Posted sessions cannot be edited');
    }

    const line = await this.prisma.inventoryStockCountLine.findUnique({ where: { id: lineId } });
    if (!line || line.companyId !== companyId || line.sessionId !== session.id) {
      throw new NotFoundException('Stock count line not found');
    }

    await this.prisma.inventoryStockCountLine.delete({ where: { id: line.id } });
    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.stock_count.line.delete',
      'inventory_stock_count_line',
      line.id,
      { sessionId: session.id, itemId: line.itemId },
      ip,
      userAgent
    );
    return { ok: true };
  }

  async postStockCountSession(actorUserId: string, companyId: string, sessionId: string, ip?: string, userAgent?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.inventoryStockCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: true, warehouse: true }
      });

      if (!session || session.companyId !== companyId) {
        throw new NotFoundException('Stock count session not found');
      }
      if (session.status === 'POSTED') {
        throw new ConflictException('Stock count session already posted');
      }

      const movements: Array<{ id: string; itemId: string; delta: number }> = [];
      for (const line of session.lines) {
        const current = await this.currentStockTx(tx, companyId, line.itemId, session.warehouseId);
        const counted = Number(line.countedQtyBase);
        const delta = Number((counted - current).toFixed(4));
        if (Math.abs(delta) < 0.0001) continue;

        const movement = await tx.inventoryStockMovement.create({
          data: {
            companyId,
            itemId: line.itemId,
            warehouseId: session.warehouseId,
            type: 'ADJUSTMENT',
            quantity: new Prisma.Decimal(delta),
            reference: `COUNT-${session.id}`,
            relatedDocumentType: 'stock_count',
            relatedDocumentId: session.id,
            createdByUserId: actorUserId
          }
        });
        movements.push({ id: movement.id, itemId: line.itemId, delta });
      }

      const posted = await tx.inventoryStockCountSession.update({
        where: { id: session.id },
        data: { status: 'POSTED' },
        include: { warehouse: true, lines: true }
      });

      return { posted, movements };
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.inventory.stock_count.post',
      'inventory_stock_count_session',
      result.posted.id,
      {
        warehouseId: result.posted.warehouseId,
        lineCount: result.posted.lines.length,
        movementCount: result.movements.length
      },
      ip,
      userAgent
    );

    return result;
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

  private async currentStockTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
    warehouseId: string
  ) {
    const rows = await tx.inventoryStockMovement.findMany({
      where: { companyId, itemId, warehouseId },
      select: { type: true, quantity: true }
    });
    let total = 0;
    for (const row of rows) {
      total += this.toStockDelta(row.type, Number(row.quantity));
    }
    return total;
  }

  private async requireStockCountSession(companyId: string, id: string) {
    const row = await this.prisma.inventoryStockCountSession.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Stock count session not found');
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

  private async requireSupplier(companyId: string, id: string) {
    const row = await this.prisma.inventorySupplier.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Supplier not found');
    }
    return row;
  }

  private async requireBrand(companyId: string, id: string) {
    const row = await this.prisma.inventoryBrand.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Brand not found');
    }
    return row;
  }

  private async setSupplierActive(
    actorUserId: string,
    companyId: string,
    id: string,
    isActive: boolean,
    ip?: string,
    userAgent?: string
  ) {
    const existing = await this.requireSupplier(companyId, id);
    try {
      const row = await this.prisma.inventorySupplier.update({
        where: { id: existing.id },
        data: { isActive }
      });
      await this.logCompany(
        actorUserId,
        companyId,
        isActive ? 'company.inventory.supplier.activate' : 'company.inventory.supplier.deactivate',
        'inventory_supplier',
        row.id,
        { status: 'success', isActive },
        ip,
        userAgent
      );
      return row;
    } catch (error) {
      await this.logCompany(
        actorUserId,
        companyId,
        isActive ? 'company.inventory.supplier.activate' : 'company.inventory.supplier.deactivate',
        'inventory_supplier',
        existing.id,
        { status: 'failed', reason: error instanceof Error ? error.message : 'unknown', isActive },
        ip,
        userAgent
      );
      throw error;
    }
  }

  private async setBrandActive(
    actorUserId: string,
    companyId: string,
    id: string,
    isActive: boolean,
    ip?: string,
    userAgent?: string
  ) {
    const existing = await this.requireBrand(companyId, id);
    try {
      const row = await this.prisma.inventoryBrand.update({
        where: { id: existing.id },
        data: { isActive }
      });
      await this.logCompany(
        actorUserId,
        companyId,
        isActive ? 'company.inventory.brand.activate' : 'company.inventory.brand.deactivate',
        'inventory_brand',
        row.id,
        { status: 'success', isActive },
        ip,
        userAgent
      );
      return row;
    } catch (error) {
      await this.logCompany(
        actorUserId,
        companyId,
        isActive ? 'company.inventory.brand.activate' : 'company.inventory.brand.deactivate',
        'inventory_brand',
        existing.id,
        { status: 'failed', reason: error instanceof Error ? error.message : 'unknown', isActive },
        ip,
        userAgent
      );
      throw error;
    }
  }

  private async setItemActive(
    actorUserId: string,
    companyId: string,
    id: string,
    isActive: boolean,
    ip?: string,
    userAgent?: string
  ) {
    const existing = await this.requireItem(companyId, id);
    try {
      const row = await this.prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { isActive },
        include: { brand: true, supplier: true }
      });
      await this.logCompany(
        actorUserId,
        companyId,
        isActive ? 'company.inventory.item.activate' : 'company.inventory.item.deactivate',
        'inventory_item',
        row.id,
        { status: 'success', isActive },
        ip,
        userAgent
      );
      return row;
    } catch (error) {
      await this.logCompany(
        actorUserId,
        companyId,
        isActive ? 'company.inventory.item.activate' : 'company.inventory.item.deactivate',
        'inventory_item',
        existing.id,
        { status: 'failed', reason: error instanceof Error ? error.message : 'unknown', isActive },
        ip,
        userAgent
      );
      throw error;
    }
  }

  private toNumberOrNull(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) return null;
    return Number(value);
  }

  private toCsv(rows: Array<Record<string, string>>) {
    const headers = Object.keys(rows[0] ?? {});
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    return [headers.map(escape).join(','), ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))].join('\n');
  }

  private toExcelXml(sheetName: string, rows: Array<Record<string, string>>) {
    const headers = Object.keys(rows[0] ?? {});
    const escape = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
    const cells = (values: string[]) =>
      values.map((value) => `<Cell><Data ss:Type="String">${escape(value)}</Data></Cell>`).join('');

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escape(sheetName)}">
  <Table>
   <Row>${cells(headers)}</Row>
   ${rows.map((row) => `<Row>${cells(headers.map((header) => row[header] ?? ''))}</Row>`).join('')}
  </Table>
 </Worksheet>
</Workbook>`;
  }

  private moneyString(value: Prisma.Decimal | null) {
    if (!value) return '-';
    return Number(value).toFixed(2).replace('.', ',');
  }

  private percentString(value: Prisma.Decimal | null) {
    if (!value) return '0';
    return (Number(value) * 100).toFixed(2).replace('.', ',');
  }

  private computePriceIncVat(
    listPriceExVat: number | null | undefined,
    discountRate: number | null | undefined,
    purchaseVatRate: number | null | undefined
  ) {
    if (listPriceExVat === null || listPriceExVat === undefined) return null;
    const discount = discountRate ?? 0;
    const vat = purchaseVatRate ?? 0.2;
    const netExVat = listPriceExVat * (1 - discount);
    const netIncVat = netExVat * (1 + vat);
    return Number(netIncVat.toFixed(4));
  }

  private unitToBaseUom(unit: string | null | undefined): 'CL' | 'ML' | 'GRAM' | 'KG' | 'PIECE' {
    const normalized = (unit ?? '').trim().toLowerCase();
    if (normalized === 'cl') return 'CL';
    if (normalized === 'ml') return 'ML';
    if (normalized === 'gram' || normalized === 'gr') return 'GRAM';
    if (normalized === 'kg') return 'KG';
    return 'PIECE';
  }

  private async requireItem(companyId: string, id: string) {
    const row = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Item not found');
    }
    return row;
  }

  private async requireItemSavedView(companyId: string, id: string) {
    const row = await this.prisma.inventoryItemSavedView.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Saved view not found');
    }
    return row;
  }

  private itemOrderBy(sortBy: string | null, sortDirection: string | null): Prisma.InventoryItemOrderByWithRelationInput[] {
    const direction = sortDirection === 'desc' ? 'desc' : 'asc';
    switch (sortBy) {
      case 'brand':
        return [{ brand: { name: direction } }, { name: 'asc' }];
      case 'supplier':
        return [{ supplier: { shortName: direction } }, { name: 'asc' }];
      case 'mainStockArea':
        return [{ mainStockArea: direction }, { name: 'asc' }];
      case 'attributeCategory':
        return [{ attributeCategory: direction }, { name: 'asc' }];
      case 'baseUom':
        return [{ baseUom: direction }, { name: 'asc' }];
      case 'purchaseVatRate':
        return [{ purchaseVatRate: direction }, { name: 'asc' }];
      case 'listPriceExVat':
        return [{ listPriceExVat: direction }, { name: 'asc' }];
      case 'discountRate':
        return [{ discountRate: direction }, { name: 'asc' }];
      case 'computedPriceIncVat':
        return [{ computedPriceIncVat: direction }, { name: 'asc' }];
      case 'isActive':
        return [{ isActive: direction }, { name: 'asc' }];
      case 'sortOrder':
        return [{ sortOrder: direction }, { name: 'asc' }];
      case 'name':
        return [{ name: direction }];
      default:
        return [{ sortOrder: 'asc' }, { name: 'asc' }];
    }
  }

  private normalizeMainStockAreaSearch(search: string): 'BAR' | 'KITCHEN' | 'OTHER' | null {
    const normalized = search.trim().toLowerCase();
    if (['bar'].includes(normalized)) return 'BAR';
    if (['mutfak', 'kitchen'].includes(normalized)) return 'KITCHEN';
    if (['diğer', 'diger', 'other'].includes(normalized)) return 'OTHER';
    return null;
  }

  private normalizeAttributeCategorySearch(search: string): 'ALCOHOL' | 'SOFT' | 'KITCHEN' | 'OTHER' | null {
    const normalized = search.trim().toLowerCase();
    if (['alkol', 'alcohol'].includes(normalized)) return 'ALCOHOL';
    if (['soft'].includes(normalized)) return 'SOFT';
    if (['mutfak', 'kitchen'].includes(normalized)) return 'KITCHEN';
    if (['diğer', 'diger', 'other'].includes(normalized)) return 'OTHER';
    return null;
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
