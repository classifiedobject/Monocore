import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recipeSchema, salesProductSchema } from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

@Injectable()
export class RecipeService {
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
      manageProduct: keys.has('module:recipe-core.product.manage'),
      manageRecipe: keys.has('module:recipe-core.recipe.manage'),
      readRecipe: keys.has('module:recipe-core.recipe.read')
    };
  }

  listProducts(companyId: string) {
    return this.prisma.salesProduct.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
  }

  async createProduct(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = salesProductSchema.parse(payload);
    const row = await this.prisma.salesProduct.create({
      data: {
        companyId,
        name: body.name,
        sku: body.sku ?? null,
        salesPrice: body.salesPrice === null || body.salesPrice === undefined ? null : new Prisma.Decimal(body.salesPrice),
        isActive: body.isActive ?? true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.recipe.product.create', 'sales_product', row.id, body, ip, userAgent);
    return row;
  }

  async updateProduct(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = salesProductSchema.partial().parse(payload);
    const existing = await this.requireProduct(companyId, id);

    const row = await this.prisma.salesProduct.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.salesPrice !== undefined
          ? { salesPrice: body.salesPrice === null ? null : new Prisma.Decimal(body.salesPrice) }
          : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.recipe.product.update', 'sales_product', row.id, body, ip, userAgent);
    return row;
  }

  listRecipes(companyId: string) {
    return this.prisma.recipe.findMany({
      where: { companyId },
      include: {
        product: true,
        lines: {
          include: { item: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getRecipeByProduct(companyId: string, productId: string) {
    await this.requireProduct(companyId, productId);
    return this.prisma.recipe.findFirst({
      where: { companyId, productId },
      include: {
        product: true,
        lines: {
          include: { item: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async createRecipe(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = recipeSchema.parse(payload);
    await this.validateRecipeBody(companyId, body);

    const existing = await this.prisma.recipe.findFirst({ where: { companyId, productId: body.productId } });
    if (existing) {
      throw new BadRequestException('Recipe already exists for this product');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          companyId,
          productId: body.productId,
          name: body.name ?? null,
          yieldQuantity: new Prisma.Decimal(body.yieldQuantity)
        }
      });

      for (const line of body.lines) {
        await tx.recipeLine.create({
          data: {
            companyId,
            recipeId: recipe.id,
            itemId: line.itemId,
            quantity: new Prisma.Decimal(line.quantity),
            unit: line.unit ?? null
          }
        });
      }

      return tx.recipe.findUniqueOrThrow({
        where: { id: recipe.id },
        include: { product: true, lines: { include: { item: true }, orderBy: { createdAt: 'asc' } } }
      });
    });

    await this.logCompany(actorUserId, companyId, 'company.recipe.create', 'recipe', row.id, body, ip, userAgent);
    return row;
  }

  async updateRecipe(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = recipeSchema.partial().parse(payload);
    const existing = await this.requireRecipe(companyId, id);
    const nextProductId = body.productId ?? existing.productId;

    if (body.productId || body.lines || body.yieldQuantity || body.name !== undefined) {
      await this.validateRecipeBody(companyId, {
        productId: nextProductId,
        name: body.name ?? existing.name ?? null,
        yieldQuantity: body.yieldQuantity ?? Number(existing.yieldQuantity),
        lines:
          body.lines ??
          (await this.prisma.recipeLine.findMany({
            where: { recipeId: existing.id },
            select: { itemId: true, quantity: true, unit: true }
          })).map((line) => ({ itemId: line.itemId, quantity: Number(line.quantity), unit: line.unit }))
      });
    }

    const duplicate = await this.prisma.recipe.findFirst({
      where: {
        companyId,
        productId: nextProductId,
        id: { not: existing.id }
      }
    });
    if (duplicate) {
      throw new BadRequestException('Another recipe already exists for the selected product');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id: existing.id },
        data: {
          ...(body.productId !== undefined ? { productId: body.productId } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.yieldQuantity !== undefined ? { yieldQuantity: new Prisma.Decimal(body.yieldQuantity) } : {})
        }
      });

      if (body.lines) {
        await tx.recipeLine.deleteMany({ where: { recipeId: existing.id } });
        for (const line of body.lines) {
          await tx.recipeLine.create({
            data: {
              companyId,
              recipeId: existing.id,
              itemId: line.itemId,
              quantity: new Prisma.Decimal(line.quantity),
              unit: line.unit ?? null
            }
          });
        }
      }

      return tx.recipe.findUniqueOrThrow({
        where: { id: existing.id },
        include: { product: true, lines: { include: { item: true }, orderBy: { createdAt: 'asc' } } }
      });
    });

    await this.logCompany(actorUserId, companyId, 'company.recipe.update', 'recipe', row.id, body, ip, userAgent);
    return row;
  }

  private async validateRecipeBody(
    companyId: string,
    body: {
      productId: string;
      name?: string | null;
      yieldQuantity: number;
      lines: Array<{ itemId: string; quantity: number; unit?: string | null }>;
    }
  ) {
    await this.requireProduct(companyId, body.productId);
    const seen = new Set<string>();
    for (const line of body.lines) {
      if (seen.has(line.itemId)) {
        throw new BadRequestException('Recipe contains duplicate ingredient item');
      }
      seen.add(line.itemId);
      await this.requireItem(companyId, line.itemId);
    }
  }

  private async requireProduct(companyId: string, id: string) {
    const row = await this.prisma.salesProduct.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Product not found');
    }
    return row;
  }

  private async requireRecipe(companyId: string, id: string) {
    const row = await this.prisma.recipe.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Recipe not found');
    }
    return row;
  }

  private async requireItem(companyId: string, id: string) {
    const row = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Inventory item not found');
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
