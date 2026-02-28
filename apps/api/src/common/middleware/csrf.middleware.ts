import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { csrfCookieOptions } from '../session-cookie.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use = (req: Request, res: Response, next: NextFunction) => {
    const csrfCookie = req.cookies?.csrf_token as string | undefined;
    if (!csrfCookie) {
      const token = crypto.randomBytes(24).toString('hex');
      res.cookie('csrf_token', token, csrfCookieOptions());
    }

    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) {
      return next();
    }

    const headerToken = req.header('x-csrf-token');
    const cookieToken = req.cookies?.csrf_token;
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return res.status(403).json({ message: 'CSRF validation failed' });
    }

    return next();
  };
}
