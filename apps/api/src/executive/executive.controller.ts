import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { ExecutiveService } from './executive.service.js';

@Controller('app-api/executive')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('executive-core')
export class ExecutiveController {
  constructor(@Inject(ExecutiveService) private readonly executive: ExecutiveService) {}

  @Get('dashboard')
  @RequirePermissions('module:executive-core.dashboard.read', 'module:executive-core.alerts.read')
  dashboard(
    @Req() req: Request & { user: { id: string }; companyId: string },
    @Query() query: Record<string, string | undefined>
  ) {
    return this.executive.dashboard(req.user.id, req.companyId, query, req.ip, req.get('user-agent'));
  }
}
