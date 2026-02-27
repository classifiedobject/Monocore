import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { FinanceService } from './finance.service.js';

@Controller('app-api/finance')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('finance-core')
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Get('categories')
  @RequirePermissions('module:finance-core.entry.read')
  listCategories(@Req() req: Request & { companyId: string }) {
    return this.finance.listCategories(req.companyId);
  }

  @Post('categories')
  @RequirePermissions('module:finance-core.entry.create')
  createCategory(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createCategory(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('categories/:categoryId')
  @RequirePermissions('module:finance-core.entry.create')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateCategory(req.user.id, req.companyId, categoryId, body, req.ip, req.get('user-agent'));
  }

  @Delete('categories/:categoryId')
  @RequirePermissions('module:finance-core.entry.delete')
  deleteCategory(@Param('categoryId') categoryId: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deleteCategory(req.user.id, req.companyId, categoryId, req.ip, req.get('user-agent'));
  }

  @Get('entries')
  @RequirePermissions('module:finance-core.entry.read')
  listEntries(@Req() req: Request & { companyId: string }) {
    return this.finance.listEntries(req.companyId);
  }

  @Post('entries')
  @RequirePermissions('module:finance-core.entry.create')
  createEntry(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createEntry(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('entries/:entryId')
  @RequirePermissions('module:finance-core.entry.create')
  updateEntry(
    @Param('entryId') entryId: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateEntry(req.user.id, req.companyId, entryId, body, req.ip, req.get('user-agent'));
  }

  @Delete('entries/:entryId')
  @RequirePermissions('module:finance-core.entry.delete')
  deleteEntry(@Param('entryId') entryId: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deleteEntry(req.user.id, req.companyId, entryId, req.ip, req.get('user-agent'));
  }

  @Get('pnl/monthly')
  @RequirePermissions('module:finance-core.entry.read')
  monthlyPnl(@Req() req: Request & { companyId: string }) {
    return this.finance.monthlyPnl(req.companyId);
  }
}
