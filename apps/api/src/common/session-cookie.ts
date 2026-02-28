import type { CookieOptions } from 'express';
import { apiEnv } from '../config/env.js';

export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: apiEnv.sessionCookieSameSite,
    secure: apiEnv.sessionCookieSecure,
    domain: apiEnv.SESSION_COOKIE_DOMAIN,
    path: '/',
    maxAge: maxAgeMs
  };
}

export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    sameSite: apiEnv.csrfCookieSameSite,
    secure: apiEnv.sessionCookieSecure,
    domain: apiEnv.SESSION_COOKIE_DOMAIN,
    path: '/'
  };
}
