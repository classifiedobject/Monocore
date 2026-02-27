import { z } from 'zod';

export const emailSchema = z.string().email().toLowerCase();
export const passwordSchema = z.string().min(8).max(128);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().min(2).max(120)
});

export const createCompanySchema = z.object({
  name: z.string().min(2).max(120)
});

export const inviteUserSchema = z.object({
  email: emailSchema,
  roleIds: z.array(z.string().uuid()).default([])
});

export const createInviteSchema = z.object({
  email: emailSchema,
  roleId: z.string().uuid().nullable().optional()
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20)
});

export const roleSchema = z.object({
  name: z.string().min(2).max(80),
  key: z.string().min(2).max(80),
  description: z.string().max(500).optional()
});

export const permissionSchema = z.object({
  key: z.string().min(3).max(120),
  description: z.string().max(500).optional()
});

export const moduleSchema = z.object({
  key: z.string().min(2).max(80),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  version: z.string().min(1).max(50),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  dependencies: z.record(z.any()).default({}),
  pricingMeta: z.record(z.any()).default({})
});

export const languagePackSchema = z.object({
  locale: z.enum(['en', 'tr']),
  namespace: z.string().min(1).max(80),
  key: z.string().min(1).max(200),
  value: z.string().min(0).max(5000)
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
