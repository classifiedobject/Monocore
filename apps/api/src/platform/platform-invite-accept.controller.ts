import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PlatformService } from './platform.service.js';
import { AuthGuard } from '../common/guards/auth.guard.js';

@Controller('platform-api/invites')
@UseGuards(AuthGuard)
export class PlatformInviteAcceptController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Post('accept')
  acceptInvite(@Body() body: unknown, @Req() req: Request & { user: { id: string } }) {
    return this.platform.acceptPlatformInvite(req.user.id, body, req.ip, req.get('user-agent'));
  }
}
