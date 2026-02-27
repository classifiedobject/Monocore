import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { SessionService } from '../../auth/session.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.session_token as string | undefined;

    if (!token) {
      throw new UnauthorizedException('Missing session');
    }

    const user = await this.sessions.resolveUser(token);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    req.user = { id: user.id, email: user.email };
    return true;
  }
}
