import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { SalesService } from './sales.service.js';

@Controller('app-api/sales')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('sales-core', 'recipe-core', 'inventory-core', 'finance-core')
export class SalesController {
  constructor(@Inject(SalesService) private readonly sales: SalesService) {}

  @Get('capabilities')
  @RequirePermissions('module:sales-core.order.read')
  capabilities(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.sales.capabilities(req.user.id, req.companyId);
  }

  @Get('orders')
  @RequirePermissions('module:sales-core.order.read')
  listOrders(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.sales.listOrders(req.companyId, query);
  }

  @Post('orders')
  @RequirePermissions('module:sales-core.order.manage')
  createOrder(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.sales.createOrder(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('orders/:id')
  @RequirePermissions('module:sales-core.order.read')
  getOrder(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.sales.getOrder(req.companyId, id);
  }

  @Patch('orders/:id')
  @RequirePermissions('module:sales-core.order.manage')
  updateOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.sales.updateOrder(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('orders/:id/post')
  @RequirePermissions('module:sales-core.order.post', 'module:finance-core.entry.create')
  postOrder(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.sales.postOrder(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('orders/:id/void')
  @RequirePermissions('module:sales-core.order.manage', 'module:finance-core.entry.create')
  voidOrder(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.sales.voidOrder(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }
}
