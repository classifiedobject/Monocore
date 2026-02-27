import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service.js';
import { REQUIRED_MODULES } from '../decorators/module-installation.decorator.js';

@Injectable()
export class ModuleInstalledGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModules =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_MODULES, [context.getHandler(), context.getClass()]) ?? [];

    if (requiredModules.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const companyId = req.companyId ?? ((req.headers['x-company-id'] as string | undefined) ?? req.query.companyId);

    if (!companyId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const installed = await this.prisma.moduleInstallation.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        moduleKey: { in: requiredModules }
      },
      select: { moduleKey: true }
    });

    const installedKeys = new Set(installed.map((row) => row.moduleKey));
    const missing = requiredModules.filter((key) => !installedKeys.has(key));

    if (missing.length > 0) {
      throw new ForbiddenException(`Required module not installed: ${missing.join(', ')}`);
    }

    return true;
  }
}
