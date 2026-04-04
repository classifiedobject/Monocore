import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
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

  @Get('rules/organization-view')
  @RequirePermissions('module:tip-core.rules.read')
  organizationRules(@Req() req: Request & { companyId: string }) {
    return this.tip.getOrganizationTipRulesView(req.companyId);
  }

  @Get('rules/departments')
  @RequirePermissions('module:tip-core.rules.read')
  listDepartmentRules(@Req() req: Request & { companyId: string }) {
    return this.tip.listTipDepartmentRules(req.companyId);
  }

  @Post('rules/departments')
  @RequirePermissions('module:tip-core.rules.manage')
  createDepartmentRule(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.upsertTipDepartmentRule(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('rules/departments/:id')
  @RequirePermissions('module:tip-core.rules.manage')
  updateDepartmentRule(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.updateTipDepartmentRule(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('rules/departments/:id/activate')
  @RequirePermissions('module:tip-core.rules.manage')
  activateDepartmentRule(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.setTipDepartmentRuleActive(req.user.id, req.companyId, id, true, req.ip, req.get('user-agent'));
  }

  @Post('rules/departments/:id/deactivate')
  @RequirePermissions('module:tip-core.rules.manage')
  deactivateDepartmentRule(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.setTipDepartmentRuleActive(req.user.id, req.companyId, id, false, req.ip, req.get('user-agent'));
  }

  @Get('rules/titles')
  @RequirePermissions('module:tip-core.rules.read')
  listTitleRules(@Req() req: Request & { companyId: string }) {
    return this.tip.listTipTitleRules(req.companyId);
  }

  @Post('rules/titles')
  @RequirePermissions('module:tip-core.rules.manage')
  createTitleRule(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.upsertTipTitleRule(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('rules/titles/:id')
  @RequirePermissions('module:tip-core.rules.manage')
  updateTitleRule(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.updateTipTitleRule(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('rules/titles/:id/activate')
  @RequirePermissions('module:tip-core.rules.manage')
  activateTitleRule(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.setTipTitleRuleActive(req.user.id, req.companyId, id, true, req.ip, req.get('user-agent'));
  }

  @Post('rules/titles/:id/deactivate')
  @RequirePermissions('module:tip-core.rules.manage')
  deactivateTitleRule(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tip.setTipTitleRuleActive(req.user.id, req.companyId, id, false, req.ip, req.get('user-agent'));
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

  @Get('weeks/:id/report')
  @RequirePermissions('module:tip-core.manage')
  weekReport(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.tip.getTipWeekReport(req.companyId, id);
  }

  @Get('weeks/:id/export.csv')
  @RequirePermissions('module:tip-core.manage')
  async exportWeekCsv(
    @Param('id') id: string,
    @Req() req: Request & { companyId: string },
    @Res({ passthrough: true }) res: Response
  ) {
    const csv = await this.tip.exportTipWeekCsv(req.companyId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tip-week-${id}.csv"`);
    return csv;
  }

  @Get('daily-inputs/export.csv')
  @RequirePermissions('module:tip-core.manage')
  async exportDailyInputsCsv(
    @Req() req: Request & { companyId: string },
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response
  ) {
    const csv = await this.tip.exportTipDailyInputsCsv(req.companyId, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tip-daily-inputs.csv"');
    return csv;
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
