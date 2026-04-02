import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  EmployeeDepartment,
  PayrollEmploymentStatus,
  PayrollGender,
  PayrollInsuranceStatus,
  Prisma,
  SalaryType
} from '@prisma/client';
import {
  payrollCompensationMatrixQuerySchema,
  payrollCompensationMatrixRowSchema,
  payrollCompensationProfileQuerySchema,
  payrollCompensationProfileSchema,
  payrollEmployeeQuerySchema,
  payrollEmployeeImportConfirmSchema,
  payrollEmployeeImportPreviewSchema,
  payrollEmployeeSchema,
  payrollEmploymentExitSchema,
  payrollEmploymentRecordQuerySchema,
  payrollEmploymentRecordSchema,
  payrollLegacyEmployeeSchema,
  payrollPeriodLineUpdateSchema,
  payrollPeriodSchema,
  payrollWorkLogQuerySchema,
  payrollWorkLogSchema
} from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

type LegacyEmployeePayload = Prisma.EmployeeGetPayload<{
  include: { role: true; profitCenter: true };
}>;

type MatrixRowPayload = Prisma.PayrollCompensationMatrixRowGetPayload<object>;
type EmploymentWithRelations = Prisma.PayrollEmploymentRecordGetPayload<{
  include: {
    employee: true;
    compensationProfiles: true;
  };
}>;

type CompensationProfileRow = EmploymentWithRelations['compensationProfiles'][number];

type PayrollLineWithRelations = Prisma.PayrollLineGetPayload<{
  include: {
    employee: true;
    employmentRecord: true;
    sourceCompensationProfile: true;
  };
}>;

type SnapshotOverrides = {
  reportDays?: number;
  handCashFinal?: number;
};

type UploadFile = { originalname?: string; buffer: Buffer };
type PayrollSnapshot = {
  accrualDays: number;
  officialDays: number;
  reportDays: number;
  targetAccrualSalary: number;
  officialNetSalary: number;
  accrualPay: number;
  officialPay: number;
  calculatedBonus: number;
  calculatedOvertime: number;
  handCashRecommended: number;
  handCashFinal: number;
  bonusAdjustment: number;
  totalPayable: number;
  difference: number;
  controlOk: boolean;
};

@Injectable()
export class PayrollService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async listEmployees(companyId: string, query: unknown = {}) {
    const parsed = payrollEmployeeQuerySchema.parse(query);
    const search = parsed.search?.trim();

    return this.prisma.payrollEmployee.findMany({
      where: {
        companyId,
        ...(parsed.status === 'active' ? { isActive: true } : {}),
        ...(parsed.status === 'inactive' ? { isActive: false } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { identityNumber: { contains: search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }]
    });
  }

  async createEmployee(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmployeeSchema.parse(payload);

    const row = await this.prisma.payrollEmployee.create({
      data: {
        companyId,
        firstName: body.firstName,
        lastName: body.lastName,
        identityNumber: body.identityNumber ?? null,
        gender: this.mapGender(body.gender ?? null),
        birthDate: this.parseNullableDate(body.birthDate ?? null),
        ibanOrBankAccount: body.ibanOrBankAccount ?? null,
        notes: body.notes ?? null,
        isActive: body.isActive ?? true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employee.create', 'payroll_employee', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async updateEmployee(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmployeeSchema.partial().parse(payload);
    const existing = await this.requirePayrollEmployee(companyId, id);

    const row = await this.prisma.payrollEmployee.update({
      where: { id: existing.id },
      data: {
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.identityNumber !== undefined ? { identityNumber: body.identityNumber } : {}),
        ...(body.gender !== undefined ? { gender: this.mapGender(body.gender) } : {}),
        ...(body.birthDate !== undefined ? { birthDate: this.parseNullableDate(body.birthDate) } : {}),
        ...(body.ibanOrBankAccount !== undefined ? { ibanOrBankAccount: body.ibanOrBankAccount } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employee.update', 'payroll_employee', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async activateEmployee(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setEmployeeActiveState(actorUserId, companyId, id, true, ip, userAgent);
  }

  async deactivateEmployee(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setEmployeeActiveState(actorUserId, companyId, id, false, ip, userAgent);
  }

  async previewEmployeeImport(
    actorUserId: string,
    companyId: string,
    file: UploadFile | undefined,
    ip?: string,
    userAgent?: string
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV dosyası gerekli');
    }

    const rows = this.parseEmployeeCsv(file.buffer);
    const payload = payrollEmployeeImportPreviewSchema.parse({ rows });
    const preview = await this.buildEmployeeImportPreview(companyId, payload.rows);

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.employee.import.preview',
      'payroll_employee_import',
      `preview:${companyId}`,
      {
        fileName: file.originalname ?? null,
        totalRows: preview.rows.length,
        validRowCount: preview.validRows.length,
        invalidRowCount: preview.invalidRows.length
      },
      ip,
      userAgent
    );

    return preview;
  }

  async confirmEmployeeImport(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmployeeImportConfirmSchema.parse(payload);
    const preview = await this.buildEmployeeImportPreview(companyId, body.rows);
    if (preview.validRows.length === 0) {
      throw new BadRequestException('İçe aktarılacak geçerli çalışan bulunamadı');
    }

    const created = await this.prisma.$transaction(
      preview.validRows.map((row) =>
        this.prisma.payrollEmployee.create({
          data: {
            companyId,
            firstName: row.firstName,
            lastName: row.lastName,
            identityNumber: row.identityNumber,
            birthDate: this.parseNullableDate(row.birthDate || null),
            ibanOrBankAccount: row.iban || null,
            isActive: true
          }
        })
      )
    );

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.employee.import.confirm',
      'payroll_employee_import',
      `confirm:${companyId}`,
      {
        createdCount: created.length,
        invalidRowCount: preview.invalidRows.length,
        employeeIds: created.map((row) => row.id)
      },
      ip,
      userAgent
    );

    return {
      createdCount: created.length,
      invalidRowCount: preview.invalidRows.length,
      created
    };
  }

  async listEmploymentRecords(companyId: string, query: unknown = {}) {
    const parsed = payrollEmploymentRecordQuerySchema.parse(query);
    const search = parsed.search?.trim();

    return this.prisma.payrollEmploymentRecord.findMany({
      where: {
        companyId,
        ...(parsed.employeeId ? { employeeId: parsed.employeeId } : {}),
        ...(parsed.status && parsed.status !== 'all' ? { status: parsed.status.toUpperCase() as PayrollEmploymentStatus } : {}),
        ...(search
          ? {
              OR: [
                { departmentName: { contains: search, mode: 'insensitive' } },
                { titleName: { contains: search, mode: 'insensitive' } },
                { employee: { firstName: { contains: search, mode: 'insensitive' } } },
                { employee: { lastName: { contains: search, mode: 'insensitive' } } }
              ]
            }
          : {})
      },
      include: {
        employee: true,
        compensationProfiles: { where: { isActive: true }, orderBy: { effectiveFrom: 'desc' }, take: 1 }
      },
      orderBy: [{ status: 'asc' }, { arrivalDate: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createEmploymentRecord(
    actorUserId: string,
    companyId: string,
    payload: unknown,
    files?: { sgkEntryDocument?: UploadFile[]; sgkExitDocument?: UploadFile[] },
    ip?: string,
    userAgent?: string
  ) {
    const body = payrollEmploymentRecordSchema.parse(this.normalizeEmploymentPayload(payload));
    const employee = await this.requirePayrollEmployee(companyId, body.employeeId);
    const arrivalDate = this.parseDate(body.arrivalDate, false);
    const sgkStartDate = this.parseNullableDate(body.sgkStartDate ?? null);
    const exitDate = this.parseNullableDate(body.exitDate ?? null);
    const accrualStartDate = this.deriveAccrualStartDate(arrivalDate, sgkStartDate);
    const status = this.mapEmploymentStatus(body.status ?? 'active');
    const insuranceStatus = this.mapInsuranceStatus(body.insuranceStatus ?? (status === 'EXITED' ? 'exited' : 'pending'));

    this.validateEmploymentDates(arrivalDate, sgkStartDate, exitDate);
    await this.ensureSingleActiveEmployment(companyId, body.employeeId, status, null);
    await this.ensureSgkDocumentConfirmation(employee, body.identityNumberConfirmed ?? false, files);
    const entryDocument = await this.persistPayrollDocument(companyId, body.employeeId, 'sgk-entry', files?.sgkEntryDocument?.[0]);
    const exitDocument = await this.persistPayrollDocument(companyId, body.employeeId, 'sgk-exit', files?.sgkExitDocument?.[0]);

    const row = await this.prisma.payrollEmploymentRecord.create({
      data: {
        companyId,
        employeeId: body.employeeId,
        departmentName: body.departmentName ?? null,
        titleName: body.titleName ?? null,
        arrivalDate,
        accrualStartDate,
        sgkStartDate,
        sgkEntryDocumentPath: entryDocument?.path ?? null,
        sgkEntryDocumentName: entryDocument?.name ?? null,
        exitDate,
        sgkExitDocumentPath: exitDocument?.path ?? null,
        sgkExitDocumentName: exitDocument?.name ?? null,
        status,
        insuranceStatus
      },
      include: { employee: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employment.create', 'payroll_employment_record', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async updateEmploymentRecord(
    actorUserId: string,
    companyId: string,
    id: string,
    payload: unknown,
    files?: { sgkEntryDocument?: UploadFile[]; sgkExitDocument?: UploadFile[] },
    ip?: string,
    userAgent?: string
  ) {
    const body = payrollEmploymentRecordSchema.partial().parse(this.normalizeEmploymentPayload(payload));
    const existing = await this.requireEmploymentRecord(companyId, id);
    const employeeId = body.employeeId ?? existing.employeeId;
    const employee = body.employeeId ? await this.requirePayrollEmployee(companyId, body.employeeId) : await this.requirePayrollEmployee(companyId, existing.employeeId);

    const arrivalDate = body.arrivalDate ? this.parseDate(body.arrivalDate, false) : existing.arrivalDate;
    const sgkStartDate = body.sgkStartDate !== undefined ? this.parseNullableDate(body.sgkStartDate) : existing.sgkStartDate;
    const exitDate = body.exitDate !== undefined ? this.parseNullableDate(body.exitDate) : existing.exitDate;
    const accrualStartDate = this.deriveAccrualStartDate(arrivalDate, sgkStartDate);
    const status = body.status ? this.mapEmploymentStatus(body.status) : existing.status;
    const insuranceStatus = body.insuranceStatus ? this.mapInsuranceStatus(body.insuranceStatus) : existing.insuranceStatus;

    this.validateEmploymentDates(arrivalDate, sgkStartDate, exitDate);
    await this.ensureSingleActiveEmployment(companyId, employeeId, status, existing.id);
    await this.ensureSgkDocumentConfirmation(employee, body.identityNumberConfirmed ?? false, files);
    const entryDocument = await this.persistPayrollDocument(companyId, employeeId, 'sgk-entry', files?.sgkEntryDocument?.[0]);
    const exitDocument = await this.persistPayrollDocument(companyId, employeeId, 'sgk-exit', files?.sgkExitDocument?.[0]);

    const row = await this.prisma.payrollEmploymentRecord.update({
      where: { id: existing.id },
      data: {
        ...(body.employeeId !== undefined ? { employeeId: body.employeeId } : {}),
        ...(body.departmentName !== undefined ? { departmentName: body.departmentName } : {}),
        ...(body.titleName !== undefined ? { titleName: body.titleName } : {}),
        ...(body.arrivalDate !== undefined ? { arrivalDate } : {}),
        accrualStartDate,
        ...(body.sgkStartDate !== undefined ? { sgkStartDate } : {}),
        ...(entryDocument ? { sgkEntryDocumentPath: entryDocument.path, sgkEntryDocumentName: entryDocument.name } : {}),
        ...(body.exitDate !== undefined ? { exitDate } : {}),
        ...(exitDocument ? { sgkExitDocumentPath: exitDocument.path, sgkExitDocumentName: exitDocument.name } : {}),
        ...(body.status !== undefined ? { status } : {}),
        ...(body.insuranceStatus !== undefined ? { insuranceStatus } : {})
      },
      include: { employee: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employment.update', 'payroll_employment_record', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async exitEmploymentRecord(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmploymentExitSchema.parse(payload);
    const existing = await this.requireEmploymentRecord(companyId, id);
    const exitDate = this.parseDate(body.exitDate, true);

    if (exitDate < existing.arrivalDate) {
      throw new BadRequestException('Çıkış tarihi geliş tarihinden önce olamaz');
    }

    const row = await this.prisma.payrollEmploymentRecord.update({
      where: { id: existing.id },
      data: {
        exitDate,
        status: 'EXITED',
        insuranceStatus: this.mapInsuranceStatus(body.insuranceStatus ?? 'exited')
      },
      include: { employee: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employment.exit', 'payroll_employment_record', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async listEmployeeEmploymentRecords(companyId: string, employeeId: string) {
    await this.requirePayrollEmployee(companyId, employeeId);
    return this.prisma.payrollEmploymentRecord.findMany({
      where: { companyId, employeeId },
      include: {
        employee: true,
        compensationProfiles: { orderBy: { effectiveFrom: 'desc' } }
      },
      orderBy: [{ arrivalDate: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async listCompensationProfiles(companyId: string, query: unknown = {}) {
    const parsed = payrollCompensationProfileQuerySchema.parse(query);
    const search = parsed.search?.trim();

    return this.prisma.payrollCompensationProfile.findMany({
      where: {
        companyId,
        ...(parsed.employmentRecordId ? { employmentRecordId: parsed.employmentRecordId } : {}),
        ...(parsed.state === 'active' ? { isActive: true } : {}),
        ...(parsed.state === 'history' ? { isActive: false } : {}),
        ...(search
          ? {
              OR: [
                { employmentRecord: { departmentName: { contains: search, mode: 'insensitive' } } },
                { employmentRecord: { titleName: { contains: search, mode: 'insensitive' } } },
                { employmentRecord: { employee: { firstName: { contains: search, mode: 'insensitive' } } } },
                { employmentRecord: { employee: { lastName: { contains: search, mode: 'insensitive' } } } }
              ]
            }
          : {})
      },
      include: {
        employmentRecord: {
          include: { employee: true }
        },
        matrixRow: true
      },
      orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createCompensationProfile(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollCompensationProfileSchema.parse(payload);
    await this.requireEmploymentRecord(companyId, body.employmentRecordId);
    const matrixRow = await this.requireCompensationMatrixRow(companyId, body.matrixRowId);

    const effectiveFrom = this.parseDate(body.effectiveFrom, false);
    const effectiveTo = this.parseNullableDate(body.effectiveTo ?? null);
    this.validateEffectiveRange(effectiveFrom, effectiveTo);
    await this.ensureNoCompensationOverlap(companyId, body.employmentRecordId, effectiveFrom, effectiveTo, body.isActive ?? true, null);

    const row = await this.prisma.payrollCompensationProfile.create({
      data: {
        companyId,
        employmentRecordId: body.employmentRecordId,
        matrixRowId: matrixRow.id,
        targetAccrualSalary: matrixRow.targetAccrualSalary,
        officialNetSalary: matrixRow.officialNetSalary,
        overtimeEligible: body.overtimeEligible ?? true,
        bonusEligible: body.bonusEligible ?? true,
        handCashAllowed: body.handCashAllowed ?? true,
        effectiveFrom,
        effectiveTo,
        isActive: body.isActive ?? true
      },
      include: {
        employmentRecord: { include: { employee: true } },
        matrixRow: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.compensation.create', 'payroll_compensation_profile', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async updateCompensationProfile(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollCompensationProfileSchema.partial().parse(payload);
    const existing = await this.requireCompensationProfile(companyId, id);
    const employmentRecordId = body.employmentRecordId ?? existing.employmentRecordId;
    if (body.employmentRecordId) await this.requireEmploymentRecord(companyId, body.employmentRecordId);
    const matrixRow = body.matrixRowId
      ? await this.requireCompensationMatrixRow(companyId, body.matrixRowId)
      : existing.matrixRowId
        ? await this.requireCompensationMatrixRow(companyId, existing.matrixRowId)
        : null;

    const effectiveFrom = body.effectiveFrom ? this.parseDate(body.effectiveFrom, false) : existing.effectiveFrom;
    const effectiveTo = body.effectiveTo !== undefined ? this.parseNullableDate(body.effectiveTo) : existing.effectiveTo;
    const isActive = body.isActive ?? existing.isActive;
    this.validateEffectiveRange(effectiveFrom, effectiveTo);
    await this.ensureNoCompensationOverlap(companyId, employmentRecordId, effectiveFrom, effectiveTo, isActive, existing.id);

    const row = await this.prisma.payrollCompensationProfile.update({
      where: { id: existing.id },
      data: {
        ...(body.employmentRecordId !== undefined ? { employmentRecordId: body.employmentRecordId } : {}),
        ...(matrixRow ? { matrixRowId: matrixRow.id, targetAccrualSalary: matrixRow.targetAccrualSalary, officialNetSalary: matrixRow.officialNetSalary } : {}),
        ...(body.overtimeEligible !== undefined ? { overtimeEligible: body.overtimeEligible } : {}),
        ...(body.bonusEligible !== undefined ? { bonusEligible: body.bonusEligible } : {}),
        ...(body.handCashAllowed !== undefined ? { handCashAllowed: body.handCashAllowed } : {}),
        ...(body.effectiveFrom !== undefined ? { effectiveFrom } : {}),
        ...(body.effectiveTo !== undefined ? { effectiveTo } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      },
      include: {
        employmentRecord: { include: { employee: true } },
        matrixRow: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.compensation.update', 'payroll_compensation_profile', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async listEmploymentCompensationProfiles(companyId: string, employmentRecordId: string) {
    await this.requireEmploymentRecord(companyId, employmentRecordId);
    return this.prisma.payrollCompensationProfile.findMany({
      where: { companyId, employmentRecordId },
      include: { employmentRecord: { include: { employee: true } }, matrixRow: true },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async listCompensationMatrix(companyId: string, query: unknown = {}) {
    const parsed = payrollCompensationMatrixQuerySchema.parse(query);
    const search = parsed.search?.trim();
    const numericSearch = search && Number.isFinite(Number(search.replace(',', '.'))) ? Number(search.replace(',', '.')) : null;

    return this.prisma.payrollCompensationMatrixRow
      .findMany({
        where: {
          companyId,
          ...(parsed.state === 'active' ? { isActive: true } : {}),
          ...(search
            ? {
                OR: [
                  ...(numericSearch !== null
                    ? [
                        { targetAccrualSalary: new Prisma.Decimal(numericSearch) },
                        { officialNetSalary: new Prisma.Decimal(numericSearch) }
                      ]
                    : []),
                  { notes: { contains: search, mode: 'insensitive' } }
                ]
              }
            : {})
        },
        orderBy: [{ isActive: 'desc' }, { targetAccrualSalary: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }]
      })
      .catch((error) => {
        if (this.isMissingPayrollCompensationMatrixTable(error)) {
          return [];
        }
        throw error;
      });
  }

  async resolveCompensationMatrix(companyId: string, query: unknown = {}) {
    const parsed = payrollCompensationMatrixQuerySchema.parse(query);
    if (parsed.targetAccrualSalary === undefined) {
      throw new BadRequestException('targetAccrualSalary is required');
    }

    const now = new Date();
    try {
      return await this.prisma.payrollCompensationMatrixRow.findFirst({
        where: {
          companyId,
          isActive: true,
          targetAccrualSalary: new Prisma.Decimal(parsed.targetAccrualSalary),
          AND: [
            { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }
          ]
        },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
      });
    } catch (error) {
      this.throwIfMissingPayrollCompensationMatrixTable(error);
      throw error;
    }
  }

  async createCompensationMatrixRow(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollCompensationMatrixRowSchema.parse(payload);
    const effectiveFrom = this.parseNullableDate(body.effectiveFrom ?? null);
    const effectiveTo = this.parseNullableDate(body.effectiveTo ?? null);
    const isActive = body.isActive ?? true;

    this.validateEffectiveRange(effectiveFrom ?? new Date('1900-01-01T00:00:00.000Z'), effectiveTo);
    await this.ensureNoMatrixOverlap(
      companyId,
      body.targetAccrualSalary,
      effectiveFrom,
      effectiveTo,
      isActive,
      null
    );

    let row;
    try {
      row = await this.prisma.payrollCompensationMatrixRow.create({
        data: {
          companyId,
          targetAccrualSalary: new Prisma.Decimal(body.targetAccrualSalary),
          officialNetSalary: new Prisma.Decimal(body.officialNetSalary),
          isActive,
          effectiveFrom,
          effectiveTo,
          notes: body.notes ?? null
        }
      });
    } catch (error) {
      this.throwIfMissingPayrollCompensationMatrixTable(error);
      throw error;
    }

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.matrix.create',
      'payroll_compensation_matrix_row',
      row.id,
      body as JsonObject,
      ip,
      userAgent
    );
    return row;
  }

  async updateCompensationMatrixRow(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollCompensationMatrixRowSchema.partial().parse(payload);
    const existing = await this.requireCompensationMatrixRow(companyId, id);
    const targetAccrualSalary = body.targetAccrualSalary ?? Number(existing.targetAccrualSalary);
    const effectiveFrom = body.effectiveFrom !== undefined ? this.parseNullableDate(body.effectiveFrom) : existing.effectiveFrom;
    const effectiveTo = body.effectiveTo !== undefined ? this.parseNullableDate(body.effectiveTo) : existing.effectiveTo;
    const isActive = body.isActive ?? existing.isActive;

    this.validateEffectiveRange(effectiveFrom ?? new Date('1900-01-01T00:00:00.000Z'), effectiveTo);
    await this.ensureNoMatrixOverlap(companyId, targetAccrualSalary, effectiveFrom, effectiveTo, isActive, existing.id);

    let row;
    try {
      row = await this.prisma.payrollCompensationMatrixRow.update({
        where: { id: existing.id },
        data: {
          ...(body.targetAccrualSalary !== undefined
            ? { targetAccrualSalary: new Prisma.Decimal(body.targetAccrualSalary) }
            : {}),
          ...(body.officialNetSalary !== undefined ? { officialNetSalary: new Prisma.Decimal(body.officialNetSalary) } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(body.effectiveTo !== undefined ? { effectiveTo } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {})
        }
      });
    } catch (error) {
      this.throwIfMissingPayrollCompensationMatrixTable(error);
      throw error;
    }

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.matrix.update',
      'payroll_compensation_matrix_row',
      row.id,
      body as JsonObject,
      ip,
      userAgent
    );
    return row;
  }

  async activateCompensationMatrixRow(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setCompensationMatrixActiveState(actorUserId, companyId, id, true, ip, userAgent);
  }

  async deactivateCompensationMatrixRow(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    return this.setCompensationMatrixActiveState(actorUserId, companyId, id, false, ip, userAgent);
  }

  async deleteCompensationMatrixRow(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const existing = await this.requireCompensationMatrixRow(companyId, id);
    try {
      await this.prisma.payrollCompensationMatrixRow.delete({ where: { id: existing.id } });
    } catch (error) {
      this.throwIfMissingPayrollCompensationMatrixTable(error);
      throw error;
    }
    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.matrix.delete',
      'payroll_compensation_matrix_row',
      existing.id,
      { deleted: true },
      ip,
      userAgent
    );
    return { ok: true };
  }
  async listWorkLogEmployees(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });
  }

  async listWorkLogs(companyId: string, query: unknown) {
    const parsed = payrollWorkLogQuerySchema.parse(query);
    return this.prisma.workLog.findMany({
      where: {
        companyId,
        ...(parsed.employeeId ? { employeeId: parsed.employeeId } : {}),
        ...(parsed.from || parsed.to
          ? {
              date: {
                ...(parsed.from ? { gte: this.parseDate(parsed.from, false) } : {}),
                ...(parsed.to ? { lte: this.parseDate(parsed.to, true) } : {})
              }
            }
          : {})
      },
      include: { employee: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createWorkLog(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollWorkLogSchema.parse(payload);
    await this.requireLegacyEmployee(companyId, body.employeeId);

    const row = await this.prisma.workLog.create({
      data: {
        companyId,
        employeeId: body.employeeId,
        date: this.parseDate(body.date, false),
        hoursWorked: new Prisma.Decimal(body.hoursWorked)
      },
      include: { employee: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.worklog.create', 'worklog', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async listPeriods(companyId: string) {
    return this.prisma.payrollPeriod.findMany({
      where: { companyId },
      include: {
        lines: {
          include: {
            employee: true,
            employmentRecord: true,
            sourceCompensationProfile: true
          },
          orderBy: [{ departmentName: 'asc' }, { titleName: 'asc' }, { employee: { firstName: 'asc' } }]
        }
      },
      orderBy: [{ startDate: 'desc' }]
    });
  }

  async getPeriod(companyId: string, id: string) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            employee: true,
            employmentRecord: true,
            sourceCompensationProfile: true
          },
          orderBy: [{ departmentName: 'asc' }, { titleName: 'asc' }, { employee: { firstName: 'asc' } }]
        }
      }
    });
    if (!period || period.companyId !== companyId) throw new NotFoundException('Payroll period not found');
    return period;
  }

  async listPeriodLines(companyId: string, id: string) {
    await this.requirePeriod(companyId, id);
    return this.prisma.payrollLine.findMany({
      where: { companyId, payrollPeriodId: id },
      include: {
        employee: true,
        employmentRecord: true,
        sourceCompensationProfile: true
      },
      orderBy: [{ departmentName: 'asc' }, { titleName: 'asc' }, { employee: { firstName: 'asc' } }]
    });
  }

  async createPeriod(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollPeriodSchema.parse(payload);
    const startDate = this.parseDate(body.startDate, false);
    const endDate = this.parseDate(body.endDate, true);
    if (startDate > endDate) throw new BadRequestException('startDate must be before endDate');

    const row = await this.prisma.payrollPeriod.create({
      data: {
        companyId,
        startDate,
        endDate,
        status: 'DRAFT',
        totalGross: new Prisma.Decimal(0),
        totalNet: new Prisma.Decimal(0)
      },
      include: { lines: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.period.create', 'payroll_period', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async calculatePeriod(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const period = await this.requirePeriod(companyId, id);
    if (period.status === 'LOCKED' || period.status === 'POSTED') {
      throw new BadRequestException('Locked or posted payroll period cannot be recalculated');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.payrollLine.deleteMany({ where: { payrollPeriodId: period.id } });

      const employments = await tx.payrollEmploymentRecord.findMany({
        where: {
          companyId,
          status: { in: ['ACTIVE', 'EXITED'] },
          arrivalDate: { lte: period.endDate },
          OR: [{ exitDate: null }, { exitDate: { gte: period.startDate } }]
        },
        include: {
          employee: true,
          compensationProfiles: {
            orderBy: [{ effectiveFrom: 'desc' }]
          }
        },
        orderBy: [{ departmentName: 'asc' }, { titleName: 'asc' }, { employee: { firstName: 'asc' } }]
      });

      let totalGross = 0;
      let totalNet = 0;
      for (const employment of employments) {
        const compensation = this.resolveCompensationProfile(employment, period.startDate, period.endDate);
        const snapshot = this.buildPayrollSnapshot(period.startDate, period.endDate, employment, compensation, {});

        await tx.payrollLine.create({
          data: {
            companyId,
            payrollPeriodId: period.id,
            employeeId: employment.employeeId,
            employmentRecordId: employment.id,
            departmentName: employment.departmentName,
            titleName: employment.titleName,
            accrualDays: snapshot.accrualDays,
            officialDays: snapshot.officialDays,
            reportDays: snapshot.reportDays,
            targetAccrualSalary: this.decimal(snapshot.targetAccrualSalary),
            officialNetSalary: this.decimal(snapshot.officialNetSalary),
            accrualPay: this.decimal(snapshot.accrualPay),
            officialPay: this.decimal(snapshot.officialPay),
            calculatedBonus: this.decimal(snapshot.calculatedBonus),
            calculatedOvertime: this.decimal(snapshot.calculatedOvertime),
            handCashRecommended: this.decimal(snapshot.handCashRecommended),
            handCashFinal: this.decimal(snapshot.handCashFinal),
            bonusAdjustment: this.decimal(snapshot.bonusAdjustment),
            totalPayable: this.decimal(snapshot.totalPayable),
            difference: this.decimal(snapshot.difference),
            controlOk: snapshot.controlOk,
            sourceCompensationProfileId: compensation?.id ?? null,
            grossAmount: this.decimal(snapshot.totalPayable),
            notes: null
          }
        });

        totalGross += snapshot.accrualPay;
        totalNet += snapshot.totalPayable;
      }

      return tx.payrollPeriod.update({
        where: { id: period.id },
        data: {
          status: 'CALCULATED',
          totalGross: this.decimal(totalGross),
          totalNet: this.decimal(totalNet)
        },
        include: {
          lines: {
            include: {
              employee: true,
              employmentRecord: true,
              sourceCompensationProfile: true
            },
            orderBy: [{ departmentName: 'asc' }, { titleName: 'asc' }, { employee: { firstName: 'asc' } }]
          }
        }
      });
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.period.calculate',
      'payroll_period',
      period.id,
      {
        periodStart: this.toYmd(period.startDate),
        periodEnd: this.toYmd(period.endDate),
        lineCount: result.lines.length,
        totalGross: Number(result.totalGross.toString()),
        totalNet: Number(result.totalNet.toString())
      },
      ip,
      userAgent
    );
    return result;
  }

  async updatePeriodLine(actorUserId: string, companyId: string, periodId: string, lineId: string, payload: unknown, ip?: string, userAgent?: string) {
    const period = await this.requirePeriod(companyId, periodId);
    if (period.status === 'LOCKED' || period.status === 'POSTED') {
      throw new BadRequestException('Locked or posted payroll lines cannot be edited');
    }

    const body = payrollPeriodLineUpdateSchema.parse(payload);
    const line = await this.requirePeriodLine(companyId, periodId, lineId);

    const snapshot = this.recalculateStoredPayrollLine(period.startDate, period.endDate, line, {
      reportDays: body.reportDays,
      handCashFinal: body.handCashFinal
    });

    const updated = await this.prisma.payrollLine.update({
      where: { id: line.id },
      data: {
        reportDays: snapshot.reportDays,
        accrualPay: this.decimal(snapshot.accrualPay),
        officialPay: this.decimal(snapshot.officialPay),
        calculatedBonus: this.decimal(snapshot.calculatedBonus),
        calculatedOvertime: this.decimal(snapshot.calculatedOvertime),
        handCashRecommended: this.decimal(snapshot.handCashRecommended),
        handCashFinal: this.decimal(snapshot.handCashFinal),
        bonusAdjustment: this.decimal(snapshot.bonusAdjustment),
        totalPayable: this.decimal(snapshot.totalPayable),
        difference: this.decimal(snapshot.difference),
        controlOk: snapshot.controlOk,
        grossAmount: this.decimal(snapshot.totalPayable),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      },
      include: {
        employee: true,
        employmentRecord: true,
        sourceCompensationProfile: true
      }
    });

    await this.refreshPeriodTotals(companyId, periodId);
    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.period.line.update',
      'payroll_line',
      line.id,
      {
        payrollPeriodId: periodId,
        reportDays: updated.reportDays,
        handCashFinal: Number(updated.handCashFinal.toString()),
        totalPayable: Number(updated.totalPayable.toString())
      },
      ip,
      userAgent
    );

    return updated;
  }

  async lockPeriod(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const period = await this.requirePeriod(companyId, id);
    if (period.status !== 'CALCULATED') throw new BadRequestException('Payroll period must be calculated before lock');

    const updated = await this.prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { status: 'LOCKED' },
      include: { lines: { include: { employee: true } } }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.period.lock', 'payroll_period', period.id, {
      periodStart: this.toYmd(period.startDate),
      periodEnd: this.toYmd(period.endDate),
      lineCount: updated.lines.length
    }, ip, userAgent);

    return updated;
  }

  async postPeriod(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const period = await this.requirePeriod(companyId, id);
    if (!['CALCULATED', 'LOCKED'].includes(period.status)) {
      throw new BadRequestException('Payroll period must be calculated or locked before posting');
    }

    const [payrollCategory, tipsCategory] = await Promise.all([
      this.ensureExpenseCategory(companyId, 'Payroll Expense'),
      this.ensureExpenseCategory(companyId, 'Tip Distribution Expense')
    ]);

    const result = await this.prisma.$transaction(async (tx) => {
      const freshPeriod = await tx.payrollPeriod.findUnique({ where: { id: period.id } });
      if (!freshPeriod || freshPeriod.companyId !== companyId) throw new NotFoundException('Payroll period not found');
      if (freshPeriod.status === 'POSTED') throw new BadRequestException('Payroll period is already posted');
      if (!['CALCULATED', 'LOCKED'].includes(freshPeriod.status)) {
        throw new BadRequestException('Payroll period must be calculated or locked before posting');
      }

      const lines = await tx.payrollLine.findMany({
        where: { companyId, payrollPeriodId: period.id },
        include: { employee: true }
      });

      if (lines.length === 0) {
        throw new BadRequestException('No payroll lines to post');
      }

      let financeEntryCount = 0;
      for (const line of lines) {
        const existingEntry = await tx.financeEntry.findFirst({
          where: {
            companyId,
            relatedDocumentType: 'payroll_line',
            relatedDocumentId: line.id
          }
        });
        if (existingEntry) continue;

        await tx.financeEntry.create({
          data: {
            companyId,
            categoryId: payrollCategory.id,
            amount: line.totalPayable,
            date: period.endDate,
            description: `Payroll ${line.employee.firstName} ${line.employee.lastName}`,
            createdByUserId: actorUserId,
            reference: `payroll:${period.id}`,
            relatedDocumentType: 'payroll_line',
            relatedDocumentId: line.id
          }
        });
        financeEntryCount += 1;
      }

      const tipPools = await tx.tipPool.findMany({
        where: {
          companyId,
          periodStart: { gte: period.startDate },
          periodEnd: { lte: period.endDate }
        },
        include: { distributions: { include: { employee: true } } }
      });

      for (const pool of tipPools) {
        for (const distribution of pool.distributions) {
          const existingTipEntry = await tx.financeEntry.findFirst({
            where: {
              companyId,
              relatedDocumentType: 'tip_pool_distribution',
              relatedDocumentId: distribution.id
            }
          });
          if (existingTipEntry) continue;

          await tx.financeEntry.create({
            data: {
              companyId,
              categoryId: tipsCategory.id,
              amount: distribution.amount,
              date: period.endDate,
              description: `Tip distribution ${distribution.employee.firstName} ${distribution.employee.lastName}`,
              createdByUserId: actorUserId,
              reference: `tip:${pool.id}`,
              relatedDocumentType: 'tip_pool_distribution',
              relatedDocumentId: distribution.id
            }
          });
          financeEntryCount += 1;
        }
      }

      const updated = await tx.payrollPeriod.update({
        where: { id: period.id },
        data: { status: 'POSTED' },
        include: { lines: { include: { employee: true } } }
      });

      return { updated, financeEntryCount };
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.period.post',
      'payroll_period',
      period.id,
      {
        context: {
          payrollPeriodId: period.id,
          startDate: this.toYmd(period.startDate),
          endDate: this.toYmd(period.endDate)
        },
        totals: {
          totalGross: Number(period.totalGross),
          totalNet: Number(period.totalNet)
        },
        counts: {
          payrollLineCount: result.updated.lines.length,
          financeEntryCount: result.financeEntryCount
        }
      },
      ip,
      userAgent
    );

    return result.updated;
  }

  private async refreshPeriodTotals(companyId: string, periodId: string) {
    const lines = await this.prisma.payrollLine.findMany({ where: { companyId, payrollPeriodId: periodId } });
    const totalGross = lines.reduce((sum, row) => sum + Number(row.accrualPay.toString()), 0);
    const totalNet = lines.reduce((sum, row) => sum + Number(row.totalPayable.toString()), 0);
    await this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: {
        totalGross: this.decimal(totalGross),
        totalNet: this.decimal(totalNet)
      }
    });
  }

  private resolveCompensationProfile(employment: EmploymentWithRelations, periodStart: Date, periodEnd: Date) {
    return employment.compensationProfiles.find((profile) => {
      if (!profile.isActive) return false;
      if (profile.effectiveFrom > periodEnd) return false;
      if (profile.effectiveTo && profile.effectiveTo < periodStart) return false;
      return true;
    }) ?? null;
  }

  private buildPayrollSnapshot(periodStart: Date, periodEnd: Date, employment: EmploymentWithRelations, profile: CompensationProfileRow | null, overrides: SnapshotOverrides): PayrollSnapshot {
    const monthDays = this.inclusiveDays(periodStart, periodEnd);
    const accrualDays = this.overlapDays(periodStart, periodEnd, employment.accrualStartDate, employment.exitDate);
    const officialDays = employment.sgkStartDate
      ? this.overlapDays(periodStart, periodEnd, employment.sgkStartDate, employment.exitDate)
      : 0;
    const reportDays = Math.max(0, Math.min(overrides.reportDays ?? 0, Math.max(accrualDays, officialDays)));

    const targetAccrualSalary = Number((profile?.targetAccrualSalary ?? new Prisma.Decimal(0)).toString());
    const officialNetSalary = Number((profile?.officialNetSalary ?? new Prisma.Decimal(0)).toString());
    const effectiveAccrualDays = Math.max(0, accrualDays - reportDays);
    const effectiveOfficialDays = Math.max(0, officialDays - reportDays);

    const accrualPay = this.round2((targetAccrualSalary * effectiveAccrualDays) / Math.max(monthDays, 1));
    const officialPay = this.round2((officialNetSalary * effectiveOfficialDays) / Math.max(monthDays, 1));

    const overtimeCap = this.computeOvertimeCap(accrualPay, employment.departmentName, profile?.overtimeEligible ?? true, targetAccrualSalary);
    const preliminaryGap = Math.max(0, this.round2(accrualPay - officialPay));
    const calculatedOvertime = Math.min(preliminaryGap, overtimeCap);
    const bonusCap = this.computeBonusCap(accrualPay, profile?.bonusEligible ?? true, targetAccrualSalary);
    const calculatedBonus = Math.min(this.round2(preliminaryGap - calculatedOvertime), bonusCap);
    const residualBeforeCash = this.round2(accrualPay - (officialPay + calculatedBonus + calculatedOvertime));
    const handCashRecommended = profile?.handCashAllowed === false ? 0 : Math.max(0, residualBeforeCash);
    const recommendedRounded = this.roundDownToTwoHundreds(handCashRecommended);
    const requestedHandCash = overrides.handCashFinal;
    const handCashFinal = this.round2(
      requestedHandCash === undefined
        ? recommendedRounded
        : Math.max(0, Math.min(requestedHandCash, Math.max(0, residualBeforeCash)))
    );
    const bonusAdjustment = this.round2(accrualPay - (officialPay + calculatedBonus + calculatedOvertime + handCashFinal));
    const totalPayable = this.round2(officialPay + calculatedBonus + calculatedOvertime + handCashFinal + bonusAdjustment);
    const difference = this.round2(accrualPay - totalPayable);

    return {
      accrualDays,
      officialDays,
      reportDays,
      targetAccrualSalary,
      officialNetSalary,
      accrualPay,
      officialPay,
      calculatedBonus,
      calculatedOvertime,
      handCashRecommended,
      handCashFinal,
      bonusAdjustment,
      totalPayable,
      difference,
      controlOk: Math.abs(difference) <= 0.01
    };
  }

  private recalculateStoredPayrollLine(periodStart: Date, periodEnd: Date, line: PayrollLineWithRelations, overrides: SnapshotOverrides): PayrollSnapshot {
    const monthDays = this.inclusiveDays(periodStart, periodEnd);
    const accrualDays = line.accrualDays;
    const officialDays = line.officialDays;
    const reportDays = Math.max(0, Math.min(overrides.reportDays ?? line.reportDays, Math.max(accrualDays, officialDays)));

    const targetAccrualSalary = Number(line.targetAccrualSalary.toString());
    const officialNetSalary = Number(line.officialNetSalary.toString());
    const effectiveAccrualDays = Math.max(0, accrualDays - reportDays);
    const effectiveOfficialDays = Math.max(0, officialDays - reportDays);

    const accrualPay = this.round2((targetAccrualSalary * effectiveAccrualDays) / Math.max(monthDays, 1));
    const officialPay = this.round2((officialNetSalary * effectiveOfficialDays) / Math.max(monthDays, 1));
    const overtimeCap = this.computeOvertimeCap(
      accrualPay,
      line.departmentName,
      line.sourceCompensationProfile?.overtimeEligible ?? true,
      targetAccrualSalary
    );
    const preliminaryGap = Math.max(0, this.round2(accrualPay - officialPay));
    const calculatedOvertime = Math.min(preliminaryGap, overtimeCap);
    const bonusCap = this.computeBonusCap(
      accrualPay,
      line.sourceCompensationProfile?.bonusEligible ?? true,
      targetAccrualSalary
    );
    const calculatedBonus = Math.min(this.round2(preliminaryGap - calculatedOvertime), bonusCap);
    const residualBeforeCash = this.round2(accrualPay - (officialPay + calculatedBonus + calculatedOvertime));
    const handCashAllowed = line.sourceCompensationProfile?.handCashAllowed ?? true;
    const handCashRecommended = handCashAllowed ? Math.max(0, residualBeforeCash) : 0;
    const recommendedRounded = this.roundDownToTwoHundreds(handCashRecommended);
    const requestedHandCash = overrides.handCashFinal;
    const handCashFinal = this.round2(
      requestedHandCash === undefined
        ? recommendedRounded
        : Math.max(0, Math.min(requestedHandCash, Math.max(0, residualBeforeCash)))
    );
    const bonusAdjustment = this.round2(accrualPay - (officialPay + calculatedBonus + calculatedOvertime + handCashFinal));
    const totalPayable = this.round2(officialPay + calculatedBonus + calculatedOvertime + handCashFinal + bonusAdjustment);
    const difference = this.round2(accrualPay - totalPayable);

    return {
      accrualDays,
      officialDays,
      reportDays,
      targetAccrualSalary,
      officialNetSalary,
      accrualPay,
      officialPay,
      calculatedBonus,
      calculatedOvertime,
      handCashRecommended,
      handCashFinal,
      bonusAdjustment,
      totalPayable,
      difference,
      controlOk: Math.abs(difference) <= 0.01
    };
  }

  private computeBonusCap(accrualPay: number, bonusEligible: boolean, targetAccrualSalary: number) {
    if (!bonusEligible) return 0;
    if (targetAccrualSalary < 40000) return 0;
    if (targetAccrualSalary < 60000) return this.round2(accrualPay * 0.04);
    if (targetAccrualSalary < 100000) return this.round2(accrualPay * 0.06);
    return this.round2(accrualPay * 0.08);
  }

  private computeOvertimeCap(accrualPay: number, departmentName: string | null, overtimeEligible: boolean, targetAccrualSalary: number) {
    if (!overtimeEligible) return 0;
    if (targetAccrualSalary < 45000) return 0;
    const normalized = (departmentName ?? '').trim().toLowerCase();
    const ratio = normalized.includes('kitchen') || normalized.includes('mutfak')
      ? 0.05
      : normalized.includes('bar')
        ? 0.04
        : normalized.includes('support')
          ? 0.02
          : 0.03;
    return this.round2(accrualPay * ratio);
  }

  private roundDownToTwoHundreds(value: number) {
    if (value <= 0) return 0;
    return Math.floor(value / 200) * 200;
  }

  private inclusiveDays(start: Date, end: Date) {
    const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return Math.max(0, Math.floor((endUtc - startUtc) / 86400000) + 1);
  }

  private overlapDays(periodStart: Date, periodEnd: Date, activeFrom: Date, activeTo: Date | null) {
    const start = activeFrom > periodStart ? activeFrom : periodStart;
    const end = activeTo && activeTo < periodEnd ? activeTo : periodEnd;
    if (start > end) return 0;
    return this.inclusiveDays(start, end);
  }

  private async setEmployeeActiveState(
    actorUserId: string,
    companyId: string,
    id: string,
    isActive: boolean,
    ip?: string,
    userAgent?: string
  ) {
    const existing = await this.requirePayrollEmployee(companyId, id);
    const row = await this.prisma.payrollEmployee.update({
      where: { id: existing.id },
      data: { isActive }
    });

    await this.logCompany(
      actorUserId,
      companyId,
      isActive ? 'company.payroll.employee.activate' : 'company.payroll.employee.deactivate',
      'payroll_employee',
      row.id,
      { isActive },
      ip,
      userAgent
    );

    return row;
  }

  private async setCompensationMatrixActiveState(
    actorUserId: string,
    companyId: string,
    id: string,
    isActive: boolean,
    ip?: string,
    userAgent?: string
  ) {
    const existing = await this.requireCompensationMatrixRow(companyId, id);
    await this.ensureNoMatrixOverlap(
      companyId,
      Number(existing.targetAccrualSalary),
      existing.effectiveFrom,
      existing.effectiveTo,
      isActive,
      existing.id
    );

    let row;
    try {
      row = await this.prisma.payrollCompensationMatrixRow.update({
        where: { id: existing.id },
        data: { isActive }
      });
    } catch (error) {
      this.throwIfMissingPayrollCompensationMatrixTable(error);
      throw error;
    }

    await this.logCompany(
      actorUserId,
      companyId,
      isActive ? 'company.payroll.matrix.activate' : 'company.payroll.matrix.deactivate',
      'payroll_compensation_matrix_row',
      row.id,
      { isActive },
      ip,
      userAgent
    );

    return row;
  }
  private deriveAccrualStartDate(arrivalDate: Date, sgkStartDate: Date | null) {
    if (!sgkStartDate) return arrivalDate;
    return sgkStartDate < arrivalDate ? sgkStartDate : arrivalDate;
  }

  private validateEmploymentDates(arrivalDate: Date, sgkStartDate: Date | null, exitDate: Date | null) {
    if (sgkStartDate && sgkStartDate < arrivalDate) {
      throw new BadRequestException('SGK tarihi geliş tarihinden önce olamaz');
    }
    if (exitDate && exitDate < arrivalDate) {
      throw new BadRequestException('Çıkış tarihi geliş tarihinden önce olamaz');
    }
  }

  private validateEffectiveRange(effectiveFrom: Date, effectiveTo: Date | null) {
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('Effective To tarihi Effective From tarihinden önce olamaz');
    }
  }

  private async ensureSingleActiveEmployment(
    companyId: string,
    employeeId: string,
    status: PayrollEmploymentStatus,
    currentId: string | null
  ) {
    if (status !== 'ACTIVE') return;
    const conflict = await this.prisma.payrollEmploymentRecord.findFirst({
      where: {
        companyId,
        employeeId,
        status: 'ACTIVE',
        ...(currentId ? { NOT: { id: currentId } } : {})
      },
      select: { id: true }
    });
    if (conflict) {
      throw new ConflictException('Bu çalışan için aynı anda birden fazla aktif istihdam kaydı olamaz');
    }
  }

  private async ensureNoCompensationOverlap(
    companyId: string,
    employmentRecordId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    isActive: boolean,
    currentId: string | null
  ) {
    if (!isActive) return;

    const conflict = await this.prisma.payrollCompensationProfile.findFirst({
      where: {
        companyId,
        employmentRecordId,
        isActive: true,
        ...(currentId ? { NOT: { id: currentId } } : {}),
        AND: [
          {
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }]
          },
          ...(effectiveTo ? [{ effectiveFrom: { lte: effectiveTo } }] : [])
        ]
      },
      select: { id: true }
    });

    if (conflict) {
      throw new ConflictException('Aynı istihdam kaydı için çakışan aktif ücret profili oluşturulamaz');
    }
  }

  private async ensureNoMatrixOverlap(
    companyId: string,
    targetAccrualSalary: number,
    effectiveFrom: Date | null,
    effectiveTo: Date | null,
    isActive: boolean,
    currentId: string | null
  ) {
    if (!isActive) return;

    let conflict;
    try {
      conflict = await this.prisma.payrollCompensationMatrixRow.findFirst({
        where: {
          companyId,
          isActive: true,
          targetAccrualSalary: new Prisma.Decimal(targetAccrualSalary),
          ...(currentId ? { NOT: { id: currentId } } : {}),
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom ?? new Date('1900-01-01T00:00:00.000Z') } }] },
            ...(effectiveTo ? [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: effectiveTo } }] }] : [])
          ]
        },
        select: { id: true }
      });
    } catch (error) {
      this.throwIfMissingPayrollCompensationMatrixTable(error);
      throw error;
    }

    if (conflict) {
      throw new ConflictException('Aynı hakediş maaşı için çakışan aktif eşleştirme oluşturulamaz');
    }
  }

  private normalizeEmploymentPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }

    const source = payload as Record<string, unknown>;
    return {
      employeeId: this.normalizeString(source.employeeId),
      departmentName: this.normalizeNullableString(source.departmentName),
      titleName: this.normalizeNullableString(source.titleName),
      arrivalDate: this.normalizeString(source.arrivalDate),
      sgkStartDate: this.normalizeNullableString(source.sgkStartDate),
      exitDate: this.normalizeNullableString(source.exitDate),
      sgkEntryDocumentName: this.normalizeNullableString(source.sgkEntryDocumentName),
      sgkEntryDocumentPath: this.normalizeNullableString(source.sgkEntryDocumentPath),
      sgkExitDocumentName: this.normalizeNullableString(source.sgkExitDocumentName),
      sgkExitDocumentPath: this.normalizeNullableString(source.sgkExitDocumentPath),
      identityNumberConfirmed: this.normalizeBoolean(source.identityNumberConfirmed),
      insuranceStatus: this.normalizeNullableString(source.insuranceStatus) ?? undefined,
      status: this.normalizeNullableString(source.status) ?? undefined
    };
  }

  private normalizeString(value: unknown) {
    if (typeof value === 'string') return value.trim();
    return value;
  }

  private normalizeNullableString(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') return null;
    return trimmed;
  }

  private normalizeBoolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  private async ensureSgkDocumentConfirmation(
    employee: { identityNumber: string | null },
    identityNumberConfirmed: boolean,
    files?: { sgkEntryDocument?: UploadFile[]; sgkExitDocument?: UploadFile[] }
  ) {
    const hasUpload = Boolean(files?.sgkEntryDocument?.[0] || files?.sgkExitDocument?.[0]);
    if (!hasUpload) return;
    if (!employee.identityNumber?.trim()) {
      throw new BadRequestException('SGK belgesi yüklemek için çalışanın kimlik numarası kayıtlı olmalıdır');
    }
    if (!identityNumberConfirmed) {
      throw new BadRequestException('SGK belgesi için kimlik numarası eşleşmesini onaylayın');
    }
  }

  private async persistPayrollDocument(companyId: string, employeeId: string, kind: 'sgk-entry' | 'sgk-exit', file?: UploadFile) {
    if (!file?.buffer?.length) return null;
    const safeOriginalName = (file.originalname ?? `${kind}.bin`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeOriginalName}`;
    const relativeDir = path.join('var', 'uploads', 'payroll', companyId, employeeId, kind);
    const absoluteDir = path.join(process.cwd(), relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), file.buffer);
    return {
      path: path.join(relativeDir, fileName),
      name: file.originalname ?? fileName
    };
  }

  private parseEmployeeCsv(buffer: Buffer) {
    const lines = buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException('CSV dosyasında en az bir veri satırı olmalıdır');
    }
    const headers = this.parseCsvLine(lines[0]).map((value) => value.trim());
    const requiredHeaders = ['firstName', 'lastName', 'identityNumber', 'birthDate', 'iban'];
    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        throw new BadRequestException(`CSV kolonları eksik. Beklenen kolon: ${header}`);
      }
    }

    return lines.slice(1).map((line) => {
      const values = this.parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
      return {
        firstName: String(row.firstName ?? '').trim(),
        lastName: String(row.lastName ?? '').trim(),
        identityNumber: String(row.identityNumber ?? '').trim(),
        birthDate: String(row.birthDate ?? '').trim(),
        iban: String(row.iban ?? '').trim()
      };
    });
  }

  private parseCsvLine(line: string) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    values.push(current);
    return values;
  }

  private async buildEmployeeImportPreview(companyId: string, rows: Array<{ firstName: string; lastName: string; identityNumber: string; birthDate: string; iban: string }>) {
    const existing = await this.prisma.payrollEmployee.findMany({
      where: { companyId, identityNumber: { not: null } },
      select: { identityNumber: true }
    });
    const existingSet = new Set(existing.map((row) => row.identityNumber?.trim()).filter(Boolean) as string[]);
    const seen = new Set<string>();

    const previewRows = rows.map((row, index) => {
      const errors: string[] = [];
      if (!row.firstName) errors.push('Ad gerekli');
      if (!row.lastName) errors.push('Soyad gerekli');
      if (!row.identityNumber) errors.push('Kimlik numarası gerekli');
      if (row.identityNumber) {
        if (seen.has(row.identityNumber)) {
          errors.push('Dosya içinde mükerrer kimlik numarası');
        }
        seen.add(row.identityNumber);
        if (existingSet.has(row.identityNumber)) {
          errors.push('Bu kimlik numarasıyla çalışan zaten kayıtlı');
        }
      }
      if (row.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.birthDate)) {
        errors.push('Doğum tarihi YYYY-MM-DD formatında olmalı');
      }
      return {
        rowNumber: index + 2,
        ...row,
        errors,
        valid: errors.length === 0
      };
    });

    return {
      rows: previewRows,
      validRows: previewRows.filter((row) => row.valid),
      invalidRows: previewRows.filter((row) => !row.valid)
    };
  }

  private async ensureExpenseCategory(companyId: string, name: string) {
    return this.prisma.financeCategory.upsert({
      where: { companyId_name: { companyId, name } },
      create: { companyId, name, type: 'EXPENSE' },
      update: { type: 'EXPENSE' }
    });
  }

  private validateLegacySalaryFields(salaryType: 'fixed' | 'hourly', baseSalary: number | null, hourlyRate: number | null) {
    if (salaryType === 'fixed' && (baseSalary === null || baseSalary === undefined)) {
      throw new BadRequestException('baseSalary is required for fixed salary type');
    }
    if (salaryType === 'hourly' && (hourlyRate === null || hourlyRate === undefined)) {
      throw new BadRequestException('hourlyRate is required for hourly salary type');
    }
  }

  async createLegacyEmployee(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollLegacyEmployeeSchema.parse(payload);
    await this.validateLegacyEmployeeRefs(companyId, body.roleId ?? null, body.profitCenterId ?? null);
    this.validateLegacySalaryFields(body.salaryType, body.baseSalary ?? null, body.hourlyRate ?? null);

    const row = await this.prisma.employee.create({
      data: {
        companyId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        roleId: body.roleId ?? null,
        profitCenterId: body.profitCenterId ?? null,
        hireDate: this.parseDate(body.hireDate, false),
        salaryType: body.salaryType === 'fixed' ? SalaryType.FIXED : SalaryType.HOURLY,
        baseSalary: body.baseSalary === null || body.baseSalary === undefined ? null : new Prisma.Decimal(body.baseSalary),
        hourlyRate: body.hourlyRate === null || body.hourlyRate === undefined ? null : new Prisma.Decimal(body.hourlyRate),
        tipWeight: body.tipWeight === undefined ? new Prisma.Decimal(1) : new Prisma.Decimal(body.tipWeight),
        department: body.department ? this.mapDepartment(body.department) : EmployeeDepartment.SERVICE,
        isActive: body.isActive ?? true
      },
      include: { role: true, profitCenter: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.legacy-employee.create', 'employee', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  private mapDepartment(value: 'service' | 'bar' | 'kitchen' | 'support' | 'other') {
    if (value === 'service') return EmployeeDepartment.SERVICE;
    if (value === 'bar') return EmployeeDepartment.BAR;
    if (value === 'kitchen') return EmployeeDepartment.KITCHEN;
    if (value === 'support') return EmployeeDepartment.SUPPORT;
    return EmployeeDepartment.OTHER;
  }

  private mapGender(value: 'female' | 'male' | 'other' | 'unspecified' | null | undefined) {
    if (value === 'female') return PayrollGender.FEMALE;
    if (value === 'male') return PayrollGender.MALE;
    if (value === 'other') return PayrollGender.OTHER;
    if (value === 'unspecified') return PayrollGender.UNSPECIFIED;
    return null;
  }

  private mapEmploymentStatus(value: 'draft' | 'active' | 'exited') {
    if (value === 'draft') return PayrollEmploymentStatus.DRAFT;
    if (value === 'exited') return PayrollEmploymentStatus.EXITED;
    return PayrollEmploymentStatus.ACTIVE;
  }

  private mapInsuranceStatus(value: 'pending' | 'insured' | 'exited') {
    if (value === 'insured') return PayrollInsuranceStatus.INSURED;
    if (value === 'exited') return PayrollInsuranceStatus.EXITED;
    return PayrollInsuranceStatus.PENDING;
  }

  private async validateLegacyEmployeeRefs(companyId: string, roleId: string | null, profitCenterId: string | null) {
    if (roleId) {
      const role = await this.prisma.companyRole.findUnique({ where: { id: roleId } });
      if (!role || role.companyId !== companyId) {
        throw new ForbiddenException('Role is not owned by tenant');
      }
    }

    if (profitCenterId) {
      const center = await this.prisma.financeProfitCenter.findUnique({ where: { id: profitCenterId } });
      if (!center || center.companyId !== companyId) {
        throw new ForbiddenException('Profit center is not owned by tenant');
      }
    }
  }

  private async requirePayrollEmployee(companyId: string, id: string) {
    const row = await this.prisma.payrollEmployee.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Çalışan bulunamadı');
    return row;
  }

  private async requireEmploymentRecord(companyId: string, id: string) {
    const row = await this.prisma.payrollEmploymentRecord.findUnique({ where: { id }, include: { employee: true } });
    if (!row || row.companyId !== companyId) throw new NotFoundException('İstihdam kaydı bulunamadı');
    return row;
  }

  private async requireCompensationProfile(companyId: string, id: string) {
    const row = await this.prisma.payrollCompensationProfile.findUnique({
      where: { id },
      include: { employmentRecord: { include: { employee: true } }, matrixRow: true }
    });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Ücret profili bulunamadı');
    return row;
  }

  private async requireCompensationMatrixRow(companyId: string, id: string): Promise<MatrixRowPayload> {
    let row;
    try {
      row = await this.prisma.payrollCompensationMatrixRow.findUnique({ where: { id } });
    } catch (error) {
      this.throwIfMissingPayrollCompensationMatrixTable(error);
      throw error;
    }
    if (!row || row.companyId !== companyId) throw new NotFoundException('Ücret eşleştirme kaydı bulunamadı');
    return row;
  }

  private isMissingPayrollCompensationMatrixTable(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021' &&
      typeof error.meta?.table === 'string' &&
      error.meta.table.includes('PayrollCompensationMatrixRow')
    );
  }

  private throwIfMissingPayrollCompensationMatrixTable(error: unknown): asserts error is never {
    if (this.isMissingPayrollCompensationMatrixTable(error)) {
      throw new BadRequestException('Ücret matrisi için veritabanı migrationı eksik. Lütfen `pnpm db:migrate` çalıştırın.');
    }
  }
  private async requireLegacyEmployee(companyId: string, id: string): Promise<LegacyEmployeePayload> {
    const row = await this.prisma.employee.findUnique({ where: { id }, include: { role: true, profitCenter: true } });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Employee not found');
    return row;
  }

  private async requirePeriod(companyId: string, id: string) {
    const row = await this.prisma.payrollPeriod.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Payroll period not found');
    return row;
  }

  private async requirePeriodLine(companyId: string, periodId: string, lineId: string): Promise<PayrollLineWithRelations> {
    const row = await this.prisma.payrollLine.findUnique({
      where: { id: lineId },
      include: {
        employee: true,
        employmentRecord: true,
        sourceCompensationProfile: true
      }
    });
    if (!row || row.companyId !== companyId || row.payrollPeriodId !== periodId) {
      throw new NotFoundException('Payroll line not found');
    }
    return row;
  }

  private parseDate(value: string, endOfDay: boolean) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
    if (endOfDay) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  private parseNullableDate(value: string | null | undefined) {
    if (!value) return null;
    return this.parseDate(value, false);
  }

  private toYmd(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private decimal(value: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(value);
  }

  private async logCompany(
    actorUserId: string,
    companyId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: JsonObject,
    ip?: string,
    userAgent?: string
  ) {
    await this.audit.logCompany({
      actorUserId,
      companyId,
      action,
      entityType,
      entityId,
      metadata,
      ip,
      userAgent
    });
  }
}
