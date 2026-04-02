import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  listEmployees(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.payroll.listEmployees(req.companyId, query);
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

  @Post('employees/:id/activate')
  @RequirePermissions('module:payroll-core.employee.manage')
  activateEmployee(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.activateEmployee(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('employees/:id/deactivate')
  @RequirePermissions('module:payroll-core.employee.manage')
  deactivateEmployee(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.deactivateEmployee(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('employees/:id/employment-records')
  @RequirePermissions('module:payroll-core.employment.read')
  listEmployeeEmploymentRecords(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.payroll.listEmployeeEmploymentRecords(req.companyId, id);
  }

  @Get('employment-records')
  @RequirePermissions('module:payroll-core.employment.read')
  listEmploymentRecords(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.payroll.listEmploymentRecords(req.companyId, query);
  }

  @Post('employment-records')
  @RequirePermissions('module:payroll-core.employment.manage')
  createEmploymentRecord(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createEmploymentRecord(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('employment-records/:id')
  @RequirePermissions('module:payroll-core.employment.manage')
  updateEmploymentRecord(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.payroll.updateEmploymentRecord(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('employment-records/:id/exit')
  @RequirePermissions('module:payroll-core.employment.manage')
  exitEmploymentRecord(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.payroll.exitEmploymentRecord(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('compensation-profiles')
  @RequirePermissions('module:payroll-core.compensation.read')
  listCompensationProfiles(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.payroll.listCompensationProfiles(req.companyId, query);
  }

  @Post('compensation-profiles')
  @RequirePermissions('module:payroll-core.compensation.manage')
  createCompensationProfile(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createCompensationProfile(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('compensation-profiles/:id')
  @RequirePermissions('module:payroll-core.compensation.manage')
  updateCompensationProfile(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.payroll.updateCompensationProfile(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('employment-records/:id/compensation-profiles')
  @RequirePermissions('module:payroll-core.compensation.read')
  listEmploymentCompensationProfiles(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.payroll.listEmploymentCompensationProfiles(req.companyId, id);
  }

  @Get('compensation-matrix')
  @RequirePermissions('module:payroll-core.matrix.read')
  listCompensationMatrix(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.payroll.listCompensationMatrix(req.companyId, query);
  }

  @Get('compensation-matrix/resolve')
  @RequirePermissions('module:payroll-core.matrix.read')
  resolveCompensationMatrix(
    @Req() req: Request & { companyId: string },
    @Query() query: Record<string, string | undefined>
  ) {
    return this.payroll.resolveCompensationMatrix(req.companyId, query);
  }

  @Post('compensation-matrix')
  @RequirePermissions('module:payroll-core.matrix.manage')
  createCompensationMatrixRow(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.createCompensationMatrixRow(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('compensation-matrix/:id')
  @RequirePermissions('module:payroll-core.matrix.manage')
  updateCompensationMatrixRow(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.payroll.updateCompensationMatrixRow(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('compensation-matrix/:id/activate')
  @RequirePermissions('module:payroll-core.matrix.manage')
  activateCompensationMatrixRow(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.activateCompensationMatrixRow(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('compensation-matrix/:id/deactivate')
  @RequirePermissions('module:payroll-core.matrix.manage')
  deactivateCompensationMatrixRow(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.deactivateCompensationMatrixRow(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Delete('compensation-matrix/:id')
  @RequirePermissions('module:payroll-core.matrix.manage')
  deleteCompensationMatrixRow(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.payroll.deleteCompensationMatrixRow(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }
  @Get('worklog-employees')
  @RequirePermissions('module:payroll-core.payroll.manage')
  listWorkLogEmployees(@Req() req: Request & { companyId: string }) {
    return this.payroll.listWorkLogEmployees(req.companyId);
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
