import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service.js';
import { REQUIRED_PERMISSIONS } from '../decorators/permissions.decorator.js';

const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  'module:payroll-core.employee.read': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.employee.manage': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.employment.read': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.employment.manage': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.compensation.read': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.compensation.manage': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.matrix.read': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.matrix.manage': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.period.read': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.period.manage': ['module:payroll-core.payroll.manage'],
  'module:payroll-core.period.post': ['module:payroll-core.payroll.post', 'module:payroll-core.payroll.manage']
};

@Injectable()
export class CompanyRbacGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id as string | undefined;
    const companyId = (req.headers['x-company-id'] as string | undefined) ?? req.query.companyId;

    if (!userId || !companyId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass()
    ]) ?? [];

    const membership = await this.prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId
        }
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Company membership required');
    }

    const userPermissions = new Set(membership.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)));
    const allowed = required.every((perm) => {
      if (userPermissions.has(perm)) return true;
      const aliases = LEGACY_PERMISSION_ALIASES[perm] ?? [];
      return aliases.some((alias) => userPermissions.has(alias));
    });
    if (!allowed) {
      throw new ForbiddenException('Missing company permissions');
    }

    req.companyId = companyId;
    return true;
  }
}
