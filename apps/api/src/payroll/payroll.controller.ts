import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { PayrollService } from './payroll.service.js';

@Controller('app-api/payroll')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('payroll-core')
export class PayrollController {
  constructor(@Inject(PayrollService) private readonly payroll: PayrollService) {}

  @Get('employees')
  @RequirePermissions('module:payroll-core.employee.manage')
  listEmployees(@Req() req: Request & { companyId: string }) {
    return this.payroll.listEmployees(req.companyId);
  }

  @Post('employees')
  @RequirePermissions('module:payroll-core.employee.manage')
  createEmployee(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createEmployee(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('employees/:id')
  @RequirePermissions('module:payroll-core.employee.manage')
  updateEmployee(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.payroll.updateEmployee(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('worklogs')
  @RequirePermissions('module:payroll-core.payroll.manage')
  listWorkLogs(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.payroll.listWorkLogs(req.companyId, query);
  }

  @Post('worklogs')
  @RequirePermissions('module:payroll-core.payroll.manage')
  createWorkLog(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createWorkLog(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('periods')
  @RequirePermissions('module:payroll-core.payroll.manage')
  listPeriods(@Req() req: Request & { companyId: string }) {
    return this.payroll.listPeriods(req.companyId);
  }

  @Post('periods')
  @RequirePermissions('module:payroll-core.payroll.manage')
  createPeriod(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createPeriod(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('periods/:id/calculate')
  @RequirePermissions('module:payroll-core.payroll.manage')
  calculatePeriod(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.calculatePeriod(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('periods/:id/post')
  @RequireInstalledModules('payroll-core', 'finance-core')
  @RequirePermissions('module:payroll-core.payroll.post', 'module:finance-core.entry.create')
  postPeriod(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.postPeriod(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('tips')
  @RequirePermissions('module:payroll-core.tip.manage')
  listTips(@Req() req: Request & { companyId: string }) {
    return this.payroll.listTips(req.companyId);
  }

  @Post('tips')
  @RequirePermissions('module:payroll-core.tip.manage')
  createTipPool(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createTipPool(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('tips/config')
  @RequirePermissions('module:payroll-core.tip.manage')
  getTipConfig(@Req() req: Request & { companyId: string }) {
    return this.payroll.getTipConfiguration(req.companyId);
  }

  @Post('tips/config')
  @RequirePermissions('module:payroll-core.tip.manage')
  saveTipConfig(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.upsertTipConfiguration(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('tips/daily-inputs')
  @RequirePermissions('module:payroll-core.tip.manage')
  listTipDailyInputs(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.payroll.listTipDailyInputs(req.companyId, query);
  }

  @Post('tips/daily-inputs')
  @RequirePermissions('module:payroll-core.tip.manage')
  upsertTipDailyInput(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.upsertTipDailyInput(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('tips/weeks')
  @RequirePermissions('module:payroll-core.tip.manage')
  listTipWeeks(@Req() req: Request & { companyId: string }) {
    return this.payroll.listTipWeeks(req.companyId);
  }

  @Post('tips/weeks')
  @RequirePermissions('module:payroll-core.tip.manage')
  createTipWeek(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createTipWeek(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('tips/weeks/:id/department-override')
  @RequirePermissions('module:payroll-core.tip.manage')
  setTipDepartmentOverride(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.payroll.setTipDepartmentOverride(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('tips/weeks/:id/calculate')
  @RequirePermissions('module:payroll-core.tip.manage')
  calculateTipWeek(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.calculateTipWeek(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('tips/weeks/:id/lock')
  @RequirePermissions('module:payroll-core.tip.manage')
  lockTipWeek(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.lockTipWeek(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('tips/weeks/:id/mark-paid')
  @RequirePermissions('module:payroll-core.tip.manage')
  markTipWeekPaid(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.markTipWeekPaid(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('tips/advance')
  @RequirePermissions('module:payroll-core.tip.manage')
  createTipAdvance(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createTipAdvance(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }
}
