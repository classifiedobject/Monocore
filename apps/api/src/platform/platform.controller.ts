import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PlatformService } from './platform.service.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { PlatformRbacGuard } from '../common/guards/platform-rbac.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';

@Controller('platform-api')
@UseGuards(AuthGuard, PlatformRbacGuard)
export class PlatformController {
  private readonly platform: PlatformService;

  constructor(@Inject(PlatformService) platform: PlatformService) {
    this.platform = platform;
  }

  @Get('dashboard')
  @RequirePermissions('platform.tenants.read')
  dashboard() {
    return this.platform.dashboard();
  }

  @Get('team')
  @RequirePermissions('platform.users.read')
  listPlatformUsers() {
    return this.platform.listPlatformUsers();
  }

  @Post('team/:membershipId/roles/:roleId')
  @RequirePermissions('platform:team.role.assign')
  assignPlatformRole(
    @Param('membershipId') membershipId: string,
    @Param('roleId') roleId: string,
    @Req() req: Request & { user: { id: string } }
  ) {
    return this.platform.assignPlatformRole(req.user.id, membershipId, roleId, req.ip, req.get('user-agent'));
  }

  @Post('sessions/invalidate/:userId')
  @RequirePermissions('platform:sessions.invalidate')
  invalidateUserSessions(@Param('userId') userId: string, @Req() req: Request & { user: { id: string } }) {
    return this.platform.invalidateUserSessions(req.user.id, userId, req.ip, req.get('user-agent'));
  }

  @Get('invites')
  @RequirePermissions('platform:team.invite.create')
  listInvites() {
    return this.platform.listPlatformInvites();
  }

  @Post('invites')
  @RequirePermissions('platform:team.invite.create')
  createInvite(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.platform.createPlatformInvite(req.user.id, body, req.ip, req.get('user-agent'));
  }

  @Post('invites/:id/resend')
  @RequirePermissions('platform:team.invite.resend')
  resendInvite(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
    return this.platform.resendPlatformInvite(id, req.user.id, req.ip, req.get('user-agent'));
  }

  @Post('invites/:id/revoke')
  @RequirePermissions('platform:team.invite.revoke')
  revokeInvite(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
    return this.platform.revokePlatformInvite(id, req.user.id, req.ip, req.get('user-agent'));
  }

  @Get('roles')
  @RequirePermissions('platform.roles.manage')
  listRoles() {
    return this.platform.listPlatformRoles();
  }

  @Post('roles')
  @RequirePermissions('platform.roles.manage')
  createRole(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.platform.createPlatformRole(req.user.id, body);
  }

  @Get('permissions')
  @RequirePermissions('platform.roles.manage')
  listPermissions() {
    return this.platform.listPlatformPermissions();
  }

  @Post('permissions')
  @RequirePermissions('platform.roles.manage')
  createPermission(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.platform.createPlatformPermission(req.user.id, body);
  }

  @Post('roles/:roleId/permissions/:permissionId')
  @RequirePermissions('platform.roles.manage')
  attachPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request & { user: { id: string } }
  ) {
    return this.platform.attachPermissionToRole(req.user.id, roleId, permissionId);
  }

  @Get('tenants')
  @RequirePermissions('platform.tenants.read')
  listCompanies() {
    return this.platform.listCompanies();
  }

  @Get('tenants/:companyId')
  @RequirePermissions('platform.tenants.read')
  companyDetails(@Param('companyId') companyId: string) {
    return this.platform.companyDetails(companyId);
  }

  @Patch('tenants/:companyId/plan')
  @RequirePermissions('platform.tenants.manage')
  updatePlan(
    @Param('companyId') companyId: string,
    @Body('plan') plan: string,
    @Req() req: Request & { user: { id: string } }
  ) {
    return this.platform.updateCompanyPlan(req.user.id, companyId, plan);
  }

  @Get('modules')
  @RequirePermissions('platform.modules.manage')
  listModules() {
    return this.platform.listModules();
  }

  @Post('modules')
  @RequirePermissions('platform.modules.manage')
  upsertModule(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.platform.upsertModule(req.user.id, body);
  }

  @Get('settings')
  @RequirePermissions('platform.settings.manage')
  listSettings() {
    return this.platform.listSettings();
  }

  @Post('settings')
  @RequirePermissions('platform.settings.manage')
  setSetting(@Body('key') key: string, @Body('value') value: string, @Req() req: Request & { user: { id: string } }) {
    return this.platform.setSetting(req.user.id, key, value);
  }

  @Get('i18n')
  @RequirePermissions('platform.i18n.manage')
  listLanguagePacks(@Query('locale') locale?: string) {
    return this.platform.listLanguagePacks(locale);
  }

  @Post('i18n')
  @RequirePermissions('platform.i18n.manage')
  upsertLanguagePack(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.platform.upsertLanguagePack(req.user.id, body);
  }
}
