import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AppApiService } from './app-api.service.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';

@Controller('app-api')
@UseGuards(AuthGuard)
export class AppApiController {
  private readonly appApi: AppApiService;

  constructor(@Inject(AppApiService) appApi: AppApiService) {
    this.appApi = appApi;
  }

  @Get('companies')
  myCompanies(@Req() req: Request & { user: { id: string } }) {
    return this.appApi.myCompanies(req.user.id);
  }

  @Post('companies')
  createCompany(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.appApi.createCompany(req.user.id, body, req.ip, req.get('user-agent'));
  }

  @Get('dashboard')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.read')
  dashboard(@Req() req: Request & { companyId: string }) {
    return this.appApi.dashboard(req.companyId);
  }

  @Get('team')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.read')
  listTeam(
    @Req() req: Request & { companyId: string },
    @Query() query: Record<string, string | undefined>
  ) {
    return this.appApi.listTeam(req.companyId, query);
  }

  @Get('invites')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.invite.create')
  listInvites(
    @Req() req: Request & { companyId: string },
    @Query() query: Record<string, string | undefined>
  ) {
    return this.appApi.listInvites(req.companyId, query);
  }

  @Post('invites')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.invite.create')
  createInvite(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.createInvite(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('invites/:id/resend')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.invite.resend')
  resendInvite(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.resendInvite(req.companyId, id, req.user.id, req.ip, req.get('user-agent'));
  }

  @Post('invites/:id/revoke')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.invite.revoke')
  revokeInvite(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.revokeInvite(req.companyId, id, req.user.id, req.ip, req.get('user-agent'));
  }

  @Post('invites/accept')
  acceptInvite(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.appApi.acceptInvite(req.user.id, body, req.ip, req.get('user-agent'));
  }

  @Get('roles')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:roles.manage')
  listRoles(@Req() req: Request & { companyId: string }) {
    return this.appApi.listRoles(req.companyId);
  }

  @Post('roles')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:roles.manage')
  createRole(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.createRole(req.user.id, req.companyId, body);
  }

  @Get('permissions')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:roles.manage')
  listPermissions() {
    return this.appApi.listPermissions();
  }

  @Post('roles/:roleId/permissions/:permissionId')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:roles.manage')
  assignPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.assignPermission(req.user.id, req.companyId, roleId, permissionId);
  }

  @Post('memberships/:membershipId/roles/:roleId')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.role.assign')
  assignMemberRole(
    @Param('membershipId') membershipId: string,
    @Param('roleId') roleId: string,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.assignMemberRole(req.user.id, req.companyId, membershipId, roleId);
  }

  @Get('audit-logs')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:audit.read')
  logs(
    @Req() req: Request & { companyId: string },
    @Query() query: Record<string, string | undefined>
  ) {
    return this.appApi.listAuditLogs(req.companyId, query);
  }

  @Get('modules')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:modules.read')
  modules(
    @Req() req: Request & { companyId: string },
    @Query() query: Record<string, string | undefined>
  ) {
    return this.appApi.listInstalledModules(req.companyId, query);
  }

  @Get('modules/catalog')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:modules.read')
  catalog(
    @Req() req: Request & { companyId: string },
    @Query() query: Record<string, string | undefined>
  ) {
    return this.appApi.listModuleCatalog(req.companyId, query);
  }

  @Post('modules/install')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:modules.install')
  installModule(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.installModule(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('company/context')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:team.read')
  companyContext(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.companyContext(req.user.id, req.companyId);
  }

  @Get('company/role-templates')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:roles.manage')
  roleTemplates() {
    return this.appApi.listRoleTemplates();
  }

  @Post('company/apply-role-template')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:roles.manage')
  applyRoleTemplate(
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.applyRoleTemplate(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('onboarding/status')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:settings.manage')
  onboardingStatus(@Req() req: Request & { companyId: string }) {
    return this.appApi.onboardingStatus(req.companyId);
  }

  @Post('onboarding/company-basics')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:settings.manage')
  onboardingCompanyBasics(
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.onboardingCompanyBasics(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('onboarding/profit-centers')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('module:finance-core.profit-center.manage')
  onboardingProfitCenters(
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.onboardingProfitCenters(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('onboarding/inventory-bootstrap')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('module:inventory-core.item.manage', 'module:inventory-core.warehouse.manage')
  onboardingInventoryBootstrap(
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.onboardingInventoryBootstrap(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('onboarding/employee')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('module:payroll-core.employee.manage')
  onboardingEmployee(
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.onboardingEmployee(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('onboarding/first-sales-order')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('module:sales-core.order.manage', 'module:sales-core.order.post')
  onboardingFirstSalesOrder(
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.onboardingFirstSalesOrder(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('demo/generate')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company:settings.manage')
  generateDemo(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.generateDemo(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }
}
