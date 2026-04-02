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

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const companyRoleTemplateSchema = z.enum([
  'owner',
  'finance_manager',
  'operations_manager',
  'floor_manager',
  'staff'
]);

export const applyRoleTemplateSchema = z.object({
  membershipId: z.string().uuid(),
  template: companyRoleTemplateSchema
});

export const companyDepartmentSchema = z.object({
  name: z.string().min(2).max(120),
  sortOrder: z.coerce.number().int().min(0).optional(),
  parentId: z.string().uuid().nullable().optional(),
  tipDepartment: z.enum(['SERVICE', 'BAR', 'KITCHEN', 'SUPPORT', 'OTHER']).optional(),
  isActive: z.boolean().optional()
});

export const companyTitleSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().min(2).max(120),
  sortOrder: z.coerce.number().int().min(0).optional(),
  tipWeight: z.coerce.number().nonnegative().max(1000),
  isTipEligible: z.boolean().default(true),
  departmentAggregate: z.boolean().default(false),
  isActive: z.boolean().optional()
});

export const companyEmployeeDirectorySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  userId: z.string().uuid().nullable().optional(),
  titleId: z.string().uuid(),
  isActive: z.boolean().optional()
});

export const onboardingCompanyBasicsSchema = z.object({
  name: z.string().min(2).max(120),
  locale: z.string().min(2).max(8).optional()
});

export const onboardingProfitCentersSchema = z.object({
  names: z.array(z.string().min(2).max(120)).min(1).max(10)
});

export const onboardingInventoryBootstrapSchema = z.object({
  warehouseName: z.string().min(2).max(120),
  itemName: z.string().min(2).max(140),
  unit: z.string().min(1).max(20).default('piece'),
  initialStock: z.coerce.number().positive().default(10)
});

export const onboardingEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  salaryType: z.enum(['fixed', 'hourly']).default('fixed'),
  baseSalary: z.coerce.number().nonnegative().default(10000),
  hourlyRate: z.coerce.number().nonnegative().default(150)
});

export const onboardingFirstSalesOrderSchema = z.object({
  productName: z.string().min(2).max(160).default('Starter Product'),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().positive().default(100),
  notes: z.string().max(500).optional()
});

export const demoGenerateSchema = z.object({
  tag: z.string().min(3).max(40).optional()
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
  relatedDocumentType: z.string().max(80).nullable().optional(),
  relatedDocumentId: z.string().max(120).nullable().optional(),
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

export const financeBudgetSchema = z.object({
  name: z.string().min(2).max(140),
  year: z.coerce.number().int().min(2000).max(2100),
  currency: z.string().min(3).max(8).default('TRY'),
  isActive: z.boolean().optional()
});

export const financeBudgetLineSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  direction: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().uuid().nullable().optional(),
  profitCenterId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().nonnegative(),
  notes: z.string().max(1000).nullable().optional()
});

export const financeBudgetLinesBulkSchema = z.object({
  lines: z.array(financeBudgetLineSchema).min(1)
});

export const financeBudgetVsActualQuerySchema = z.object({
  budgetId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  profitCenterId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional()
});

export const financeCashflowForecastItemSchema = z.object({
  direction: z.enum(['INFLOW', 'OUTFLOW']),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(8).default('TRY'),
  description: z.string().min(2).max(300),
  profitCenterId: z.string().uuid().nullable().optional()
});

export const financeCashflowProjectionQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const taskBoardSchema = z.object({
  name: z.string().min(2).max(140)
});

export const taskTemplateSchema = z.object({
  boardId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  scheduleType: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('NONE'),
  scheduleMeta: z.record(z.any()).nullable().optional(),
  defaultAssigneeType: z.enum(['USER', 'ROLE']),
  defaultAssigneeUserId: z.string().uuid().nullable().optional(),
  defaultAssigneeRoleId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional()
});

export const taskInstanceSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  boardId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED']).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  assigneeRoleId: z.string().uuid().nullable().optional()
});

export const taskQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED']).optional(),
  assigneeUserId: z.string().uuid().optional(),
  assigneeRoleId: z.string().uuid().optional(),
  overdue: z.union([z.literal('true'), z.literal('false')]).optional()
});

export const taskGenerateQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const taskCommentSchema = z.object({
  message: z.string().min(1).max(2000)
});

export const reservationCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().max(140).nullable().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const reservationCustomerQuerySchema = z.object({
  search: z.string().min(1).optional()
});

export const reservationTagSchema = z.object({
  name: z.string().min(1).max(80)
});

export const reservationTagLinkSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1)
});

export const reservationSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(160),
  phone: z.string().max(40).nullable().optional(),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservationTime: z.string().regex(/^\d{2}:\d{2}$/),
  guestCount: z.coerce.number().int().positive(),
  status: z.enum(['BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELED', 'NO_SHOW']).optional(),
  tableRef: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const reservationQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELED', 'NO_SHOW']).optional()
});

export const reservationStatusSchema = z.object({
  newStatus: z.enum(['BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELED', 'NO_SHOW'])
});

export const reservationSummaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
export const inventoryWarehouseSchema = z.object({
  name: z.string().min(2).max(140),
  location: z.string().max(300).nullable().optional(),
  isActive: z.boolean().optional()
});

const inventoryItemBaseSchema = z.object({
  name: z.string().min(2).max(160),
  sku: z.string().max(80).nullable().optional(),
  code: z.string().max(80).optional(),
  unit: z.string().min(1).max(20).default('piece'),
  brandId: z.string().uuid().nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  mainStockArea: z.enum(['BAR', 'KITCHEN', 'OTHER']).default('OTHER'),
  attributeCategory: z.enum(['ALCOHOL', 'SOFT', 'KITCHEN', 'OTHER']).default('OTHER'),
  subCategory: z.string().max(120).nullable().optional(),
  baseUom: z.enum(['CL', 'ML', 'GRAM', 'KG', 'PIECE']).default('PIECE'),
  packageUom: z.enum(['BOTTLE', 'PACK', 'PIECE']).nullable().optional(),
  packageSizeBase: z.coerce.number().positive().nullable().optional(),
  purchaseVatRate: z.coerce.number().min(0).max(1).default(0.2),
  listPriceExVat: z.coerce.number().nonnegative().nullable().optional(),
  discountRate: z.coerce.number().min(0).max(1).default(0),
  priceDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  sortOrder: z.coerce.number().int().min(0).default(1000),
  lastPurchaseUnitCost: z.coerce.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional()
});

function validateInventoryItemPackage(value: { packageUom?: unknown; packageSizeBase?: unknown }, ctx: z.RefinementCtx) {
  if (value.packageUom && (value.packageSizeBase === null || value.packageSizeBase === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['packageSizeBase'],
      message: 'packageSizeBase is required when packageUom is provided'
    });
  }
}

export const inventoryItemSchema = inventoryItemBaseSchema.superRefine(validateInventoryItemPackage);

export const inventoryItemUpdateSchema = inventoryItemBaseSchema.partial().superRefine(validateInventoryItemPackage);

export const inventoryItemCostSchema = z.object({
  lastPurchaseUnitCost: z.coerce.number().nonnegative().nullable()
});

export const inventoryItemBulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  isActive: z.boolean()
});

export const inventoryItemBulkExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  format: z.enum(['csv', 'excel'])
});

export const inventoryItemListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum(['all', 'active', 'inactive']).optional(),
  mainStockArea: z.enum(['BAR', 'KITCHEN', 'OTHER']).optional(),
  attributeCategory: z.enum(['ALCOHOL', 'SOFT', 'KITCHEN', 'OTHER']).optional(),
  subCategory: z.string().trim().min(1).optional(),
  sortBy: z
    .enum([
      'name',
      'brand',
      'supplier',
      'mainStockArea',
      'attributeCategory',
      'baseUom',
      'purchaseVatRate',
      'listPriceExVat',
      'discountRate',
      'computedPriceIncVat',
      'isActive',
      'sortOrder'
    ])
    .optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

const inventoryItemSavedViewFiltersSchema = z.object({
  brandId: z.string().uuid().nullable().optional(),
  status: z.enum(['all', 'active', 'inactive']).nullable().optional(),
  mainStockArea: z.enum(['BAR', 'KITCHEN', 'OTHER']).nullable().optional(),
  attributeCategory: z.enum(['ALCOHOL', 'SOFT', 'KITCHEN', 'OTHER']).nullable().optional(),
  subCategory: z.string().trim().max(120).nullable().optional()
});

export const inventoryItemSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional(),
  filtersJson: inventoryItemSavedViewFiltersSchema.default({}),
  searchQuery: z.string().trim().max(200).nullable().optional(),
  sortBy: inventoryItemListQuerySchema.shape.sortBy.nullable().optional(),
  sortDirection: inventoryItemListQuerySchema.shape.sortDirection.nullable().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).nullable().optional()
});

export const inventoryItemSavedViewUpdateSchema = inventoryItemSavedViewSchema.partial();

export const inventoryItemQuerySchema = z.object({
  sortBy: z
    .enum(['code', 'brand', 'packageSizeBase', 'subCategory', 'priceDate', 'listPriceExVat', 'discountRate', 'grossPrice', 'status', 'name'])
    .optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  search: z.string().max(160).optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

export const inventoryItemsExportQuerySchema = inventoryItemQuerySchema.extend({
  scope: z.enum(['filtered', 'all']).default('filtered')
});

export const inventoryItemImportRowSchema = z.object({
  anaFirma: z.string().min(1).optional(),
  urunAdi: z.string().min(1),
  miktari: z.union([z.string(), z.number()]),
  stokTakipBirimi: z.string().min(1),
  listeFiyatiKdvHaric: z.union([z.string(), z.number()]).optional(),
  iskontosu: z.union([z.string(), z.number()]).optional(),
  fiyatTarihi: z.string().optional(),
  alisKdvOrani: z.union([z.string(), z.number()]).optional(),
  gelirMerkeziKategorisi: z.string().optional(),
  stokKategorisi: z.string().optional(),
  urunGrubu: z.string().optional(),
  distributor: z.string().optional(),
  paketTipi: z.string().optional(),
  aktifMi: z.union([z.string(), z.boolean()]).optional()
});

export const inventoryItemImportConfirmSchema = z.object({
  rows: z.array(inventoryItemImportRowSchema).min(1)
});

export const inventoryMovementSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.coerce.number().refine((value) => value !== 0, 'Quantity cannot be zero'),
  reference: z.string().max(120).nullable().optional(),
  relatedDocumentType: z.enum(['purchase', 'sale', 'manual', 'transfer']).nullable().optional(),
  relatedDocumentId: z.string().max(120).nullable().optional()
});

export const inventoryTransferSchema = z.object({
  itemId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reference: z.string().max(120).nullable().optional()
});

export const inventoryMovementQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const inventoryStockBalanceQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional()
});

export const inventoryStockCountSessionSchema = z.object({
  warehouseId: z.string().uuid(),
  countDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).nullable().optional()
});

export const inventoryStockCountLineUpsertSchema = z.object({
  itemId: z.string().uuid(),
  countedQtyBase: z.coerce.number().min(0).nullable().optional(),
  closedPackageQty: z.coerce.number().int().min(0).nullable().optional(),
  openPackageCount: z.coerce.number().int().min(0).nullable().optional(),
  openQtyBase: z.coerce.number().min(0).nullable().optional()
});

export const inventorySupplierSchema = z.object({
  shortName: z.string().min(1).max(140),
  legalName: z.string().min(1).max(240),
  address: z.string().max(400).nullable().optional(),
  addressLine: z.string().max(400).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  district: z.string().max(120).nullable().optional(),
  taxOffice: z.string().max(120).nullable().optional(),
  taxNumber: z
    .string()
    .max(80)
    .regex(/^\d*$/, 'taxNumber must contain only digits')
    .nullable()
    .optional(),
  contactName: z.string().max(140).nullable().optional(),
  contactPhone: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional()
});

export const inventorySupplierQuerySchema = z.object({
  search: z.string().max(120).optional(),
  sortBy: z.enum(['shortName', 'legalName', 'taxOffice', 'taxNumber', 'status']).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  filterMissingBrandLink: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return value === 'true';
    })
});

export const inventoryBrandSchema = z.object({
  name: z.string().min(1).max(160),
  shortName: z.string().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional()
});

export const inventoryBrandQuerySchema = z.object({
  search: z.string().max(120).optional(),
  sortBy: z.enum(['name', 'status', 'supplier']).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  filterMissingSupplier: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return value === 'true';
    })
});

export const inventoryBrandSupplierLinkSchema = z.object({
  supplierId: z.string().uuid()
});

export const salesProductSchema = z.object({
  name: z.string().min(2).max(160),
  sku: z.string().max(80).nullable().optional(),
  salesPrice: z.coerce.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional()
});

export const recipeLineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().max(30).nullable().optional()
});

export const recipeSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().max(160).nullable().optional(),
  yieldQuantity: z.coerce.number().positive().default(1),
  lines: z.array(recipeLineSchema).min(1)
});

export const salesOrderLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative()
});

export const salesOrderSchema = z.object({
  orderNo: z.string().max(80).nullable().optional(),
  orderDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  profitCenterId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  reservationId: z.string().uuid().nullable().optional(),
  currency: z.string().min(3).max(8).default('TRY'),
  notes: z.string().max(1000).nullable().optional(),
  lines: z.array(salesOrderLineSchema).min(1)
});

export const salesOrderQuerySchema = z.object({
  status: z.enum(['DRAFT', 'POSTED', 'VOID']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  profitCenterId: z.string().uuid().optional()
});

export const executiveDashboardQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const payrollEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  identityNumber: z.string().max(30).nullable().optional(),
  gender: z.enum(['female', 'male', 'other', 'unspecified']).nullable().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ibanOrBankAccount: z.string().max(140).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional()
});

export const payrollEmployeeQuerySchema = z.object({
  search: z.string().max(120).optional(),
  status: z.enum(['active', 'inactive', 'all']).optional()
});

export const payrollLegacyEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(140).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
  profitCenterId: z.string().uuid().nullable().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  salaryType: z.enum(['fixed', 'hourly']),
  baseSalary: z.coerce.number().nonnegative().nullable().optional(),
  hourlyRate: z.coerce.number().nonnegative().nullable().optional(),
  tipWeight: z.coerce.number().positive().max(1000).optional(),
  department: z.enum(['service', 'bar', 'kitchen', 'support', 'other']).optional(),
  isActive: z.boolean().optional()
});

export const payrollEmploymentRecordSchema = z.object({
  employeeId: z.string().uuid(),
  departmentName: z.string().max(120).nullable().optional(),
  titleName: z.string().max(120).nullable().optional(),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accrualStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sgkStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(['draft', 'active', 'exited']).optional(),
  insuranceStatus: z.enum(['pending', 'insured', 'exited']).optional()
});

export const payrollEmploymentRecordQuerySchema = z.object({
  search: z.string().max(120).optional(),
  status: z.enum(['draft', 'active', 'exited', 'all']).optional(),
  employeeId: z.string().uuid().optional()
});

export const payrollEmploymentExitSchema = z.object({
  exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  insuranceStatus: z.enum(['pending', 'insured', 'exited']).optional()
});

export const payrollCompensationProfileSchema = z.object({
  employmentRecordId: z.string().uuid(),
  targetAccrualSalary: z.coerce.number().nonnegative(),
  officialNetSalary: z.coerce.number().nonnegative(),
  overtimeEligible: z.boolean().optional(),
  bonusEligible: z.boolean().optional(),
  handCashAllowed: z.boolean().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional()
});

export const payrollCompensationProfileQuerySchema = z.object({
  search: z.string().max(120).optional(),
  state: z.enum(['active', 'history', 'all']).optional(),
  employmentRecordId: z.string().uuid().optional()
});

export const payrollCompensationMatrixRowSchema = z.object({
  targetAccrualSalary: z.coerce.number().nonnegative(),
  officialNetSalary: z.coerce.number().nonnegative(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional()
});

export const payrollCompensationMatrixQuerySchema = z.object({
  search: z.string().max(120).optional(),
  state: z.enum(['active', 'all']).optional(),
  targetAccrualSalary: z.coerce.number().nonnegative().optional()
});

export const payrollWorkLogSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hoursWorked: z.coerce.number().positive()
});

export const payrollWorkLogQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const payrollPeriodSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const tipPoolSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalTips: z.coerce.number().nonnegative(),
  distributionMethod: z.enum(['equal', 'hours_weighted'])
});

export const tipConfigurationSchema = z.object({
  serviceRate: z.coerce.number().nonnegative().max(1),
  serviceTaxDeductionRate: z.coerce.number().nonnegative().max(1).default(0.4),
  visaTaxDeductionRate: z.coerce.number().nonnegative().max(1).default(0.4),
  defaultWastePoints: z.coerce.number().nonnegative().default(0),
  allowDepartmentSubPool: z.boolean().default(false)
});

export const tipWeekSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceRateUsed: z.coerce.number().nonnegative().max(1).optional(),
  wastePointsUsed: z.coerce.number().nonnegative().optional(),
  payableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

export const tipDailyInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grossRevenue: z.coerce.number().nonnegative().default(0),
  discounts: z.coerce.number().nonnegative().default(0),
  comps: z.coerce.number().nonnegative().default(0),
  wastageSales: z.coerce.number().nonnegative().default(0),
  cariAdisyonTotal: z.coerce.number().nonnegative().default(0),
  cashTips: z.coerce.number().nonnegative().default(0),
  visaTipsGross: z.coerce.number().nonnegative().default(0),
  expenseAdjustments: z.coerce.number().nonnegative().default(0)
});

export const tipAdvanceSchema = z.object({
  tipWeekId: z.string().uuid(),
  directoryEmployeeId: z.string().uuid(),
  amount: z.coerce.number().positive()
});

export const tipDepartmentOverrideSchema = z.object({
  department: z.enum(['service', 'bar', 'kitchen', 'support', 'other']),
  overrideWeight: z.coerce.number().nonnegative()
});
export const languagePackSchema = z.object({
  locale: z.enum(['en', 'tr']),
  namespace: z.string().min(1).max(80),
  key: z.string().min(1).max(200),
  value: z.string().min(0).max(5000)
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
