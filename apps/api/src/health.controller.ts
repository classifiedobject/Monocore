import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from './common/prisma.service.js';

@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('healthz')
  healthz() {
    return { ok: true };
  }

  @Get('readyz')
  async readyz() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
