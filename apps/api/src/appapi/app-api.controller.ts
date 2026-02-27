import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
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
  @RequirePermissions('company.team.read')
  dashboard(@Req() req: Request & { companyId: string }) {
    return this.appApi.dashboard(req.companyId);
  }

  @Get('team')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.team.read')
  listTeam(@Req() req: Request & { companyId: string }) {
    return this.appApi.listTeam(req.companyId);
  }

  @Post('team/invite')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.team.invite')
  inviteMember(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.inviteMember(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('roles')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.roles.manage')
  listRoles(@Req() req: Request & { companyId: string }) {
    return this.appApi.listRoles(req.companyId);
  }

  @Post('roles')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.roles.manage')
  createRole(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.appApi.createRole(req.user.id, req.companyId, body);
  }

  @Get('permissions')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.roles.manage')
  listPermissions() {
    return this.appApi.listPermissions();
  }

  @Post('roles/:roleId/permissions/:permissionId')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.roles.manage')
  assignPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.assignPermission(req.user.id, req.companyId, roleId, permissionId);
  }

  @Post('memberships/:membershipId/roles/:roleId')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.roles.manage')
  assignMemberRole(
    @Param('membershipId') membershipId: string,
    @Param('roleId') roleId: string,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.appApi.assignMemberRole(req.user.id, req.companyId, membershipId, roleId);
  }

  @Get('audit-logs')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.audit.read')
  logs(@Req() req: Request & { companyId: string }) {
    return this.appApi.listAuditLogs(req.companyId);
  }

  @Get('modules')
  @UseGuards(CompanyRbacGuard)
  @RequirePermissions('company.team.read')
  modules(@Req() req: Request & { companyId: string }) {
    return this.appApi.listInstalledModules(req.companyId);
  }
}
