import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AuthGuard } from '../common/guards/auth.guard.js';

@Controller('auth')
export class AuthController {
  private readonly auth: AuthService;

  constructor(@Inject(AuthService) auth: AuthService) {
    this.auth = auth;
  }

  @Post('register')
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(body, req.ip, req.get('user-agent'));
    res.cookie('session_token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 14 * 24 * 60 * 60 * 1000
    });
    return { id: result.user.id, email: result.user.email, fullName: result.user.fullName };
  }

  @Post('login')
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body, req.ip, req.get('user-agent'));
    res.cookie('session_token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 14 * 24 * 60 * 60 * 1000
    });
    return { id: result.user.id, email: result.user.email, fullName: result.user.fullName };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Req() req: Request & { user?: { id: string } }, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.session_token as string | undefined;
    if (token) {
      await this.auth.logout(token, req.user?.id, req.ip, req.get('user-agent'));
    }
    res.clearCookie('session_token');
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request & { user?: { id: string; email: string } }) {
    return req.user;
  }
}
