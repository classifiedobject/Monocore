import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { InventoryService } from './inventory.service.js';

@Controller('app-api/inventory')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('inventory-core')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Get('capabilities')
  @RequirePermissions('module:inventory-core.movement.read')
  capabilities(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.capabilities(req.user.id, req.companyId);
  }

  @Get('warehouses')
  @RequirePermissions('module:inventory-core.movement.read')
  listWarehouses(@Req() req: Request & { companyId: string }) {
    return this.inventory.listWarehouses(req.companyId);
  }

  @Post('warehouses')
  @RequirePermissions('module:inventory-core.warehouse.manage')
  createWarehouse(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createWarehouse(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('warehouses/:id')
  @RequirePermissions('module:inventory-core.warehouse.manage')
  updateWarehouse(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateWarehouse(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('items')
  @RequirePermissions('module:inventory-core.movement.read')
  listItems(@Req() req: Request & { companyId: string }) {
    return this.inventory.listItems(req.companyId);
  }

  @Post('items')
  @RequirePermissions('module:inventory-core.item.manage')
  createItem(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createItem(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('items/:id')
  @RequirePermissions('module:inventory-core.item.manage')
  updateItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateItem(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Patch('items/:id/cost')
  @RequirePermissions('module:inventory-core.item.cost.manage')
  updateItemCost(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateItemCost(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('movements')
  @RequirePermissions('module:inventory-core.movement.read')
  listMovements(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.inventory.listMovements(req.companyId, query);
  }

  @Post('movements')
  @RequirePermissions('module:inventory-core.movement.manage')
  createMovement(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createMovement(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('transfer')
  @RequirePermissions('module:inventory-core.movement.manage')
  transfer(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.transfer(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('stock-balance')
  @RequirePermissions('module:inventory-core.movement.read')
  stockBalance(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.inventory.stockBalance(req.companyId, query);
  }
}
