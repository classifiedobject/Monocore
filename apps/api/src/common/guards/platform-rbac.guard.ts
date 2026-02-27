import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service.js';
import { REQUIRED_PERMISSIONS } from '../decorators/permissions.decorator.js';

@Injectable()
export class PlatformRbacGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id as string | undefined;

    if (!userId) {
      throw new ForbiddenException('No authenticated user');
    }

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass()
    ]) ?? [];

    const membership = await this.prisma.platformMembership.findUnique({
      where: { userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });

    if (!membership?.isActive) {
      throw new ForbiddenException('Platform access denied');
    }

    const userPermissions = new Set(
      membership.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))
    );

    const allowed = required.every((perm) => userPermissions.has(perm));
    if (!allowed) {
      throw new ForbiddenException('Missing platform permissions');
    }

    return true;
  }
}
