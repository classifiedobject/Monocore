import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { PrismaService } from './common/prisma.service.js';
import { SessionService } from './auth/session.service.js';
import { PlatformController } from './platform/platform.controller.js';
import { PlatformService } from './platform/platform.service.js';
import { PlatformInviteAcceptController } from './platform/platform-invite-accept.controller.js';
import { AppApiController } from './appapi/app-api.controller.js';
import { AppApiService } from './appapi/app-api.service.js';
import { AuditService } from './common/audit.service.js';
import { RedisService } from './redis/redis.service.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { PlatformRbacGuard } from './common/guards/platform-rbac.guard.js';
import { CompanyRbacGuard } from './common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from './common/guards/module-installed.guard.js';
import { FinanceController } from './finance/finance.controller.js';
import { FinanceService } from './finance/finance.service.js';
import { InventoryController } from './inventory/inventory.controller.js';
import { InventoryService } from './inventory/inventory.service.js';
import { RecipeController } from './recipe/recipe.controller.js';
import { RecipeService } from './recipe/recipe.service.js';
import { SalesController } from './sales/sales.controller.js';
import { SalesService } from './sales/sales.service.js';
import { TasksController } from './tasks/tasks.controller.js';
import { TasksService } from './tasks/tasks.service.js';
import { ReservationsController } from './reservations/reservations.controller.js';
import { ReservationsService } from './reservations/reservations.service.js';
import { ExecutiveController } from './executive/executive.controller.js';
import { ExecutiveService } from './executive/executive.service.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120
      }
    ])
  ],
  controllers: [
    AuthController,
    PlatformController,
    PlatformInviteAcceptController,
    AppApiController,
    FinanceController,
    InventoryController,
    RecipeController,
    SalesController,
    TasksController,
    ReservationsController,
    ExecutiveController,
    HealthController
  ],
  providers: [
    PrismaService,
    SessionService,
    AuthService,
    PlatformService,
    AppApiService,
    FinanceService,
    InventoryService,
    RecipeService,
    SalesService,
    TasksService,
    ReservationsService,
    ExecutiveService,
    AuditService,
    RedisService,
    AuthGuard,
    PlatformRbacGuard,
    CompanyRbacGuard,
    ModuleInstalledGuard
  ]
})
export class AppModule {}
