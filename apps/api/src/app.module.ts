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

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120
      }
    ])
  ],
  controllers: [AuthController, PlatformController, PlatformInviteAcceptController, AppApiController],
  providers: [
    PrismaService,
    SessionService,
    AuthService,
    PlatformService,
    AppApiService,
    AuditService,
    RedisService,
    AuthGuard,
    PlatformRbacGuard,
    CompanyRbacGuard
  ]
})
export class AppModule {}
