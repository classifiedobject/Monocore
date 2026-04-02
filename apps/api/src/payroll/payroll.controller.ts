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
  @RequirePermissions('module:payroll-core.employee.read')
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
  @RequirePermissions('module:payroll-core.period.read')
  listPeriods(@Req() req: Request & { companyId: string }) {
    return this.payroll.listPeriods(req.companyId);
  }

  @Get('periods/:id')
  @RequirePermissions('module:payroll-core.period.read')
  getPeriod(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.payroll.getPeriod(req.companyId, id);
  }

  @Post('periods')
  @RequirePermissions('module:payroll-core.period.manage')
  createPeriod(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createPeriod(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('periods/:id/calculate')
  @RequirePermissions('module:payroll-core.period.manage')
  calculatePeriod(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.calculatePeriod(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('periods/:id/lock')
  @RequirePermissions('module:payroll-core.period.manage')
  lockPeriod(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.lockPeriod(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('periods/:id/lines')
  @RequirePermissions('module:payroll-core.period.read')
  listPeriodLines(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.payroll.listPeriodLines(req.companyId, id);
  }

  @Patch('periods/:id/lines/:lineId')
  @RequirePermissions('module:payroll-core.period.manage')
  updatePeriodLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.payroll.updatePeriodLine(req.user.id, req.companyId, id, lineId, body, req.ip, req.get('user-agent'));
  }

  @Post('periods/:id/post')
  @RequirePermissions('module:payroll-core.period.post', 'module:finance-core.entry.create')
  postPeriod(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.postPeriod(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }
}
