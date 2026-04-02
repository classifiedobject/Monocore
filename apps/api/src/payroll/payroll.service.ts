import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  EmployeeDepartment,
  PayrollEmploymentStatus,
  PayrollGender,
  PayrollInsuranceStatus,
  Prisma,
  SalaryType
} from '@prisma/client';
import {
  payrollCompensationProfileQuerySchema,
  payrollCompensationProfileSchema,
  payrollEmployeeQuerySchema,
  payrollEmployeeSchema,
  payrollEmploymentExitSchema,
  payrollEmploymentRecordQuerySchema,
  payrollEmploymentRecordSchema,
  payrollLegacyEmployeeSchema,
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

  async createEmploymentRecord(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmploymentRecordSchema.parse(payload);
    await this.requirePayrollEmployee(companyId, body.employeeId);

    const arrivalDate = this.parseDate(body.arrivalDate, false);
    const accrualStartDate = this.parseDate(body.accrualStartDate, false);
    const sgkStartDate = this.parseNullableDate(body.sgkStartDate ?? null);
    const exitDate = this.parseNullableDate(body.exitDate ?? null);
    const status = this.mapEmploymentStatus(body.status ?? 'active');
    const insuranceStatus = this.mapInsuranceStatus(body.insuranceStatus ?? (status === 'EXITED' ? 'exited' : 'pending'));

    this.validateEmploymentDates(arrivalDate, accrualStartDate, sgkStartDate, exitDate);
    await this.ensureSingleActiveEmployment(companyId, body.employeeId, status, null);

    const row = await this.prisma.payrollEmploymentRecord.create({
      data: {
        companyId,
        employeeId: body.employeeId,
        departmentName: body.departmentName ?? null,
        titleName: body.titleName ?? null,
        arrivalDate,
        accrualStartDate,
        sgkStartDate,
        exitDate,
        status,
        insuranceStatus
      },
      include: { employee: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employment.create', 'payroll_employment_record', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async updateEmploymentRecord(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmploymentRecordSchema.partial().parse(payload);
    const existing = await this.requireEmploymentRecord(companyId, id);
    const employeeId = body.employeeId ?? existing.employeeId;
    if (body.employeeId) await this.requirePayrollEmployee(companyId, body.employeeId);

    const arrivalDate = body.arrivalDate ? this.parseDate(body.arrivalDate, false) : existing.arrivalDate;
    const accrualStartDate = body.accrualStartDate ? this.parseDate(body.accrualStartDate, false) : existing.accrualStartDate;
    const sgkStartDate = body.sgkStartDate !== undefined ? this.parseNullableDate(body.sgkStartDate) : existing.sgkStartDate;
    const exitDate = body.exitDate !== undefined ? this.parseNullableDate(body.exitDate) : existing.exitDate;
    const status = body.status ? this.mapEmploymentStatus(body.status) : existing.status;
    const insuranceStatus = body.insuranceStatus ? this.mapInsuranceStatus(body.insuranceStatus) : existing.insuranceStatus;

    this.validateEmploymentDates(arrivalDate, accrualStartDate, sgkStartDate, exitDate);
    await this.ensureSingleActiveEmployment(companyId, employeeId, status, existing.id);

    const row = await this.prisma.payrollEmploymentRecord.update({
      where: { id: existing.id },
      data: {
        ...(body.employeeId !== undefined ? { employeeId: body.employeeId } : {}),
        ...(body.departmentName !== undefined ? { departmentName: body.departmentName } : {}),
        ...(body.titleName !== undefined ? { titleName: body.titleName } : {}),
        ...(body.arrivalDate !== undefined ? { arrivalDate } : {}),
        ...(body.accrualStartDate !== undefined ? { accrualStartDate } : {}),
        ...(body.sgkStartDate !== undefined ? { sgkStartDate } : {}),
        ...(body.exitDate !== undefined ? { exitDate } : {}),
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
        }
      },
      orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createCompensationProfile(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollCompensationProfileSchema.parse(payload);
    await this.requireEmploymentRecord(companyId, body.employmentRecordId);

    const effectiveFrom = this.parseDate(body.effectiveFrom, false);
    const effectiveTo = this.parseNullableDate(body.effectiveTo ?? null);
    this.validateEffectiveRange(effectiveFrom, effectiveTo);
    await this.ensureNoCompensationOverlap(companyId, body.employmentRecordId, effectiveFrom, effectiveTo, body.isActive ?? true, null);

    const row = await this.prisma.payrollCompensationProfile.create({
      data: {
        companyId,
        employmentRecordId: body.employmentRecordId,
        targetAccrualSalary: new Prisma.Decimal(body.targetAccrualSalary),
        officialNetSalary: new Prisma.Decimal(body.officialNetSalary),
        overtimeEligible: body.overtimeEligible ?? true,
        bonusEligible: body.bonusEligible ?? true,
        handCashAllowed: body.handCashAllowed ?? true,
        effectiveFrom,
        effectiveTo,
        isActive: body.isActive ?? true
      },
      include: {
        employmentRecord: { include: { employee: true } }
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

    const effectiveFrom = body.effectiveFrom ? this.parseDate(body.effectiveFrom, false) : existing.effectiveFrom;
    const effectiveTo = body.effectiveTo !== undefined ? this.parseNullableDate(body.effectiveTo) : existing.effectiveTo;
    const isActive = body.isActive ?? existing.isActive;
    this.validateEffectiveRange(effectiveFrom, effectiveTo);
    await this.ensureNoCompensationOverlap(companyId, employmentRecordId, effectiveFrom, effectiveTo, isActive, existing.id);

    const row = await this.prisma.payrollCompensationProfile.update({
      where: { id: existing.id },
      data: {
        ...(body.employmentRecordId !== undefined ? { employmentRecordId: body.employmentRecordId } : {}),
        ...(body.targetAccrualSalary !== undefined ? { targetAccrualSalary: new Prisma.Decimal(body.targetAccrualSalary) } : {}),
        ...(body.officialNetSalary !== undefined ? { officialNetSalary: new Prisma.Decimal(body.officialNetSalary) } : {}),
        ...(body.overtimeEligible !== undefined ? { overtimeEligible: body.overtimeEligible } : {}),
        ...(body.bonusEligible !== undefined ? { bonusEligible: body.bonusEligible } : {}),
        ...(body.handCashAllowed !== undefined ? { handCashAllowed: body.handCashAllowed } : {}),
        ...(body.effectiveFrom !== undefined ? { effectiveFrom } : {}),
        ...(body.effectiveTo !== undefined ? { effectiveTo } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      },
      include: {
        employmentRecord: { include: { employee: true } }
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.compensation.update', 'payroll_compensation_profile', row.id, body as JsonObject, ip, userAgent);
    return row;
  }

  async listEmploymentCompensationProfiles(companyId: string, employmentRecordId: string) {
    await this.requireEmploymentRecord(companyId, employmentRecordId);
    return this.prisma.payrollCompensationProfile.findMany({
      where: { companyId, employmentRecordId },
      include: { employmentRecord: { include: { employee: true } } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }]
    });
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
        lines: { include: { employee: true }, orderBy: { createdAt: 'asc' } }
      },
      orderBy: [{ startDate: 'desc' }]
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
    if (period.status === 'POSTED') throw new BadRequestException('Posted payroll period cannot be recalculated');

    const employees = await this.prisma.employee.findMany({ where: { companyId, isActive: true } });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.payrollLine.deleteMany({ where: { payrollPeriodId: period.id } });

      const worklogs = await tx.workLog.findMany({
        where: {
          companyId,
          date: { gte: period.startDate, lte: period.endDate }
        }
      });

      const hoursByEmployee = new Map<string, number>();
      for (const row of worklogs) {
        hoursByEmployee.set(row.employeeId, (hoursByEmployee.get(row.employeeId) ?? 0) + Number(row.hoursWorked.toString()));
      }

      let total = 0;
      for (const employee of employees) {
        let gross = 0;
        if (employee.salaryType === 'FIXED') {
          gross = Number((employee.baseSalary ?? new Prisma.Decimal(0)).toString());
        } else {
          const rate = Number((employee.hourlyRate ?? new Prisma.Decimal(0)).toString());
          gross = (hoursByEmployee.get(employee.id) ?? 0) * rate;
        }

        await tx.payrollLine.create({
          data: {
            companyId,
            payrollPeriodId: period.id,
            employeeId: employee.id,
            grossAmount: new Prisma.Decimal(gross),
            notes: employee.salaryType === 'HOURLY' ? 'Calculated by worklogs' : 'Fixed salary'
          }
        });
        total += gross;
      }

      const updated = await tx.payrollPeriod.update({
        where: { id: period.id },
        data: {
          status: 'CALCULATED',
          totalGross: new Prisma.Decimal(total),
          totalNet: new Prisma.Decimal(total)
        },
        include: {
          lines: { include: { employee: true }, orderBy: { createdAt: 'asc' } }
        }
      });

      return updated;
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.period.calculate',
      'payroll_period',
      period.id,
      { totalGross: String(result.totalGross) },
      ip,
      userAgent
    );
    return result;
  }

  async postPeriod(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const period = await this.requirePeriod(companyId, id);
    if (period.status !== 'CALCULATED') throw new BadRequestException('Payroll period must be calculated before posting');

    const [payrollCategory, tipsCategory] = await Promise.all([
      this.ensureExpenseCategory(companyId, 'Payroll Expense'),
      this.ensureExpenseCategory(companyId, 'Tip Distribution Expense')
    ]);

    const result = await this.prisma.$transaction(async (tx) => {
      const lines = await tx.payrollLine.findMany({
        where: { companyId, payrollPeriodId: period.id },
        include: { employee: true }
      });

      if (lines.length === 0) {
        throw new BadRequestException('No payroll lines to post');
      }

      let financeEntryCount = 0;
      for (const line of lines) {
        await tx.financeEntry.create({
          data: {
            companyId,
            categoryId: payrollCategory.id,
            amount: line.grossAmount,
            date: period.endDate,
            description: `Payroll ${line.employee.firstName} ${line.employee.lastName}`,
            createdByUserId: actorUserId,
            profitCenterId: line.employee.profitCenterId,
            reference: `payroll:${period.id}`,
            relatedDocumentType: 'payroll',
            relatedDocumentId: period.id
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
          await tx.financeEntry.create({
            data: {
              companyId,
              categoryId: tipsCategory.id,
              amount: distribution.amount,
              date: period.endDate,
              description: `Tip distribution ${distribution.employee.firstName} ${distribution.employee.lastName}`,
              createdByUserId: actorUserId,
              profitCenterId: distribution.employee.profitCenterId,
              reference: `tip:${pool.id}`,
              relatedDocumentType: 'tip_pool',
              relatedDocumentId: pool.id
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

  private validateEmploymentDates(
    arrivalDate: Date,
    accrualStartDate: Date,
    sgkStartDate: Date | null,
    exitDate: Date | null
  ) {
    if (accrualStartDate < arrivalDate) {
      throw new BadRequestException('Hakediş başlangıç tarihi geliş tarihinden önce olamaz');
    }
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
      include: { employmentRecord: { include: { employee: true } } }
    });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Ücret profili bulunamadı');
    return row;
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
