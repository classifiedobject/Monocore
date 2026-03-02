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
  status: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED']),
  dependencies: z.record(z.any()).default({}),
  pricingMeta: z.record(z.any()).default({})
});

export const installModuleSchema = z.object({
  moduleKey: z.string().min(2).max(80),
  config: z.record(z.any()).default({})
});

export const financeCategorySchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(['INCOME', 'EXPENSE'])
});

export const financeEntrySchema = z.object({
  categoryId: z.string().uuid(),
  counterpartyId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  profitCenterId: z.string().uuid().nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  paymentId: z.string().uuid().nullable().optional(),
  reference: z.string().max(120).nullable().optional(),
  amount: z.coerce.number().positive(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  description: z.string().max(500).optional()
});

export const financeCounterpartySchema = z.object({
  type: z.enum(['VENDOR', 'CUSTOMER', 'OTHER']),
  name: z.string().min(2).max(140),
  taxId: z.string().max(80).nullable().optional(),
  email: z.string().email().max(140).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  notes: z.string().max(1000).nullable().optional()
});

export const financeAccountSchema = z.object({
  type: z.enum(['CASH', 'BANK', 'POS', 'OTHER']),
  name: z.string().min(2).max(140),
  currency: z.string().min(3).max(8).default('TRY'),
  isActive: z.boolean().optional()
});

export const financeRecurringRuleSchema = z.object({
  name: z.string().min(2).max(140),
  direction: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  frequency: z.enum(['WEEKLY', 'MONTHLY']),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  nextRunAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  isActive: z.boolean().optional(),
  counterpartyId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional()
});

export const financeReportRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accountId: z.string().uuid().optional()
});

export const financeProfitCenterSchema = z.object({
  name: z.string().min(2).max(140),
  code: z.string().max(40).nullable().optional(),
  type: z.enum(['GENERAL', 'SERVICE', 'DEPARTMENT', 'LOCATION', 'EVENT', 'OTHER']),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional()
});

export const financeProfitCenterReportSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  profitCenterId: z.string().uuid().optional()
});

export const financeAllocationTargetSchema = z.object({
  profitCenterId: z.string().uuid(),
  percentage: z.coerce.number().gt(0).lte(100)
});

export const financeAllocationRuleSchema = z.object({
  name: z.string().min(2).max(140),
  sourceCategoryId: z.string().uuid().nullable().optional(),
  sourceEntryId: z.string().uuid().nullable().optional(),
  allocationMethod: z.enum(['PERCENTAGE']).default('PERCENTAGE'),
  isActive: z.boolean().optional(),
  targets: z.array(financeAllocationTargetSchema).min(1)
});

export const financeApplyAllocationSchema = z.object({
  sourceEntryId: z.string().uuid()
});

export const financeInvoiceLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().min(0).max(100).nullable().optional()
});

export const financeInvoiceSchema = z.object({
  direction: z.enum(['PAYABLE', 'RECEIVABLE']),
  counterpartyId: z.string().uuid(),
  invoiceNo: z.string().min(1).max(80),
  issueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  currency: z.string().min(3).max(8).default('TRY'),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID']).optional(),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(financeInvoiceLineSchema).min(1)
});

export const financeInvoiceQuerySchema = z.object({
  direction: z.enum(['PAYABLE', 'RECEIVABLE']).optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  counterpartyId: z.string().uuid().optional()
});

export const financePaymentSchema = z.object({
  direction: z.enum(['OUTGOING', 'INCOMING']),
  counterpartyId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  paymentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(8).default('TRY'),
  reference: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const financePaymentQuerySchema = z.object({
  direction: z.enum(['OUTGOING', 'INCOMING']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  counterpartyId: z.string().uuid().optional()
});

export const financePaymentAllocateSchema = z.object({
  allocations: z.array(z.object({ invoiceId: z.string().uuid(), amount: z.coerce.number().positive() })).min(1)
});

export const financeAgingQuerySchema = z.object({
  direction: z.enum(['PAYABLE', 'RECEIVABLE']),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const financeCounterpartyBalanceQuerySchema = z.object({
  direction: z.enum(['PAYABLE', 'RECEIVABLE'])
});
export const languagePackSchema = z.object({
  locale: z.enum(['en', 'tr']),
  namespace: z.string().min(1).max(80),
  key: z.string().min(1).max(200),
  value: z.string().min(0).max(5000)
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
