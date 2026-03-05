import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { TipService } from './tip.service.js';

@Controller('app-api/tips')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('tip-core')
export class TipController {
  constructor(@Inject(TipService) private readonly tip: TipService) {}

  @Get('employees')
  @RequirePermissions('module:tip-core.manage')
  listEmployees(@Req() req: Request & { companyId: string }) {
    return this.tip.listEmployees(req.companyId);
  }

  @Get('config')
  @RequirePermissions('module:tip-core.manage')
  getConfig(@Req() req: Request & { companyId: string }) {
    return this.tip.getTipConfiguration(req.companyId);
  }

  @Post('config')
  @RequirePermissions('module:tip-core.manage')
  saveConfig(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.upsertTipConfiguration(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('daily-inputs')
  @RequirePermissions('module:tip-core.manage')
  listDailyInputs(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.tip.listTipDailyInputs(req.companyId, query);
  }

  @Post('daily-inputs')
  @RequirePermissions('module:tip-core.manage')
  saveDailyInput(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.upsertTipDailyInput(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('weeks')
  @RequirePermissions('module:tip-core.manage')
  listWeeks(@Req() req: Request & { companyId: string }) {
    return this.tip.listTipWeeks(req.companyId);
  }

  @Post('weeks')
  @RequirePermissions('module:tip-core.manage')
  createWeek(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.createTipWeek(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('weeks/:id/calculate')
  @RequirePermissions('module:tip-core.manage')
  calculateWeek(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.calculateTipWeek(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('weeks/:id/lock')
  @RequirePermissions('module:tip-core.manage')
  lockWeek(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.lockTipWeek(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('weeks/:id/mark-paid')
  @RequirePermissions('module:tip-core.manage')
  markPaid(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.markTipWeekPaid(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('weeks/:id/department-override')
  @RequirePermissions('module:tip-core.manage')
  setOverride(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.tip.setTipDepartmentOverride(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('advance')
  @RequirePermissions('module:tip-core.manage')
  createAdvance(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.createTipAdvance(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }
}
