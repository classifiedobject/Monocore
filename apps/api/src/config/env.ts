import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const boolLike = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return value.toLowerCase() === 'true';
  });

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars'),
  SESSION_INACTIVITY_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().positive().default(90),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SESSION_COOKIE_SECURE: boolLike.optional(),
  SESSION_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),
  CSRF_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),
  API_TRUST_PROXY: z.union([z.literal('true'), z.literal('false'), z.coerce.number().int().nonnegative()]).optional()
});

const parsed = apiEnvSchema.safeParse(process.env);
if (!parsed.success) {
  const flattened = parsed.error.flatten().fieldErrors;
  console.error('Invalid API environment configuration', flattened);
  throw new Error('Invalid API environment configuration');
}

const raw = parsed.data;
const secureDefault = raw.NODE_ENV === 'production';
const sameSiteDefault = secureDefault ? 'none' : 'lax';

export const apiEnv = {
  ...raw,
  corsOrigins: raw.CORS_ORIGINS.split(',').map((entry) => entry.trim()).filter(Boolean),
  sessionCookieSecure: raw.SESSION_COOKIE_SECURE ?? secureDefault,
  sessionCookieSameSite: raw.SESSION_COOKIE_SAMESITE ?? sameSiteDefault,
  csrfCookieSameSite: raw.CSRF_COOKIE_SAMESITE ?? sameSiteDefault,
  trustProxy: raw.API_TRUST_PROXY
    ? raw.API_TRUST_PROXY === 'true'
      ? true
      : raw.API_TRUST_PROXY === 'false'
        ? false
        : Number(raw.API_TRUST_PROXY)
    : false
} as const;
