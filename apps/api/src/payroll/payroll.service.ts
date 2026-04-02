import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  payrollEmployeeSchema,
  payrollPeriodLineUpdateSchema,
  payrollPeriodSchema,
  payrollWorkLogQuerySchema,
  payrollWorkLogSchema
} from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;
type JsonValue = Prisma.InputJsonValue;
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

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

type LegacyEmployeeWithRefs = Prisma.EmployeeGetPayload<{
  include: {
    role: true;
    profitCenter: true;
  };
}>;

type SnapshotOverrides = {
  reportDays?: number;
  handCashFinal?: number;
};

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

  async listEmployees(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId },
      include: { role: true, profitCenter: true },
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }, { lastName: 'asc' }]
    });
  }

  async createEmployee(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmployeeSchema.parse(payload);
    await this.validateEmployeeRefs(companyId, body.roleId ?? null, body.profitCenterId ?? null);
    this.validateSalaryFields(body.salaryType, body.baseSalary ?? null, body.hourlyRate ?? null);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          companyId,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email ?? null,
          phone: body.phone ?? null,
          roleId: body.roleId ?? null,
          profitCenterId: body.profitCenterId ?? null,
          hireDate: this.parseDate(body.hireDate, false),
          salaryType: body.salaryType === 'fixed' ? 'FIXED' : 'HOURLY',
          baseSalary: body.baseSalary === null || body.baseSalary === undefined ? null : new Prisma.Decimal(body.baseSalary),
          hourlyRate: body.hourlyRate === null || body.hourlyRate === undefined ? null : new Prisma.Decimal(body.hourlyRate),
          tipWeight: body.tipWeight === undefined ? new Prisma.Decimal(1) : new Prisma.Decimal(body.tipWeight),
          department: body.department ? this.mapDepartment(body.department) : 'SERVICE',
          isActive: body.isActive ?? true
        },
        include: { role: true, profitCenter: true }
      });

      await this.syncPayrollMirrorForLegacyEmployee(tx as unknown as TxClient, created);
      return created;
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employee.create', 'employee', row.id, body as unknown as JsonObject, ip, userAgent);
    return row;
  }

  async updateEmployee(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = payrollEmployeeSchema.partial().parse(payload);
    const existing = await this.requireEmployee(companyId, id);

    const mergedSalaryType = body.salaryType ?? (existing.salaryType === 'FIXED' ? 'fixed' : 'hourly');
    const mergedBase = body.baseSalary === undefined ? existing.baseSalary : body.baseSalary;
    const mergedHourly = body.hourlyRate === undefined ? existing.hourlyRate : body.hourlyRate;
    this.validateSalaryFields(mergedSalaryType, mergedBase ? Number(mergedBase.toString()) : null, mergedHourly ? Number(mergedHourly.toString()) : null);

    await this.validateEmployeeRefs(
      companyId,
      body.roleId === undefined ? existing.roleId : body.roleId,
      body.profitCenterId === undefined ? existing.profitCenterId : body.profitCenterId
    );

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: existing.id },
        data: {
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.roleId !== undefined ? { roleId: body.roleId } : {}),
          ...(body.profitCenterId !== undefined ? { profitCenterId: body.profitCenterId } : {}),
          ...(body.hireDate !== undefined ? { hireDate: this.parseDate(body.hireDate, false) } : {}),
          ...(body.salaryType !== undefined ? { salaryType: body.salaryType === 'fixed' ? 'FIXED' : 'HOURLY' } : {}),
          ...(body.baseSalary !== undefined
            ? { baseSalary: body.baseSalary === null ? null : new Prisma.Decimal(body.baseSalary) }
            : {}),
          ...(body.hourlyRate !== undefined
            ? { hourlyRate: body.hourlyRate === null ? null : new Prisma.Decimal(body.hourlyRate) }
            : {}),
          ...(body.tipWeight !== undefined ? { tipWeight: new Prisma.Decimal(body.tipWeight) } : {}),
          ...(body.department !== undefined ? { department: this.mapDepartment(body.department) } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
        },
        include: { role: true, profitCenter: true }
      });
      await this.syncPayrollMirrorForLegacyEmployee(tx as unknown as TxClient, updated);
      return updated;
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employee.update', 'employee', row.id, body as unknown as JsonObject, ip, userAgent);
    return row;
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
    await this.requireEmployee(companyId, body.employeeId);

    const row = await this.prisma.workLog.create({
      data: {
        companyId,
        employeeId: body.employeeId,
        date: this.parseDate(body.date, false),
        hoursWorked: new Prisma.Decimal(body.hoursWorked)
      },
      include: { employee: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.worklog.create', 'worklog', row.id, body as unknown as JsonObject, ip, userAgent);
    return row;
  }

  async listPeriods(companyId: string) {
    return this.prisma.payrollPeriod.findMany({
      where: { companyId },
      include: {
        lines: {
          include: { employee: true },
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

    await this.logCompany(actorUserId, companyId, 'company.payroll.period.create', 'payroll_period', row.id, body as unknown as JsonObject, ip, userAgent);
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
            include: { employee: true },
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

      if (lines.length === 0) throw new BadRequestException('No payroll lines to post');

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

  private async syncPayrollMirrorForLegacyEmployee(tx: TxClient, employee: LegacyEmployeeWithRefs) {
    await tx.payrollEmployee.upsert({
      where: { id: employee.id },
      create: {
        id: employee.id,
        companyId: employee.companyId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        isActive: employee.isActive
      },
      update: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        isActive: employee.isActive
      }
    });

    let employment = await tx.payrollEmploymentRecord.findFirst({
      where: {
        companyId: employee.companyId,
        employeeId: employee.id,
        exitDate: null
      },
      orderBy: { arrivalDate: 'asc' }
    });

    if (!employment) {
      employment = await tx.payrollEmploymentRecord.create({
        data: {
          companyId: employee.companyId,
          employeeId: employee.id,
          arrivalDate: employee.hireDate,
          accrualStartDate: employee.hireDate,
          sgkStartDate: employee.hireDate,
          status: employee.isActive ? 'ACTIVE' : 'DRAFT',
          insuranceStatus: employee.isActive ? 'INSURED' : 'PENDING'
        }
      });
    }

    const activeProfile = await tx.payrollCompensationProfile.findFirst({
      where: {
        companyId: employee.companyId,
        employmentRecordId: employment.id,
        isActive: true,
        effectiveTo: null
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    const salarySeed = Number((employee.baseSalary ?? new Prisma.Decimal(0)).toString());

    if (!activeProfile) {
      await tx.payrollCompensationProfile.create({
        data: {
          companyId: employee.companyId,
          employmentRecordId: employment.id,
          targetAccrualSalary: this.decimal(salarySeed),
          officialNetSalary: this.decimal(salarySeed),
          overtimeEligible: true,
          bonusEligible: true,
          handCashAllowed: true,
          effectiveFrom: employee.hireDate,
          isActive: true
        }
      });
    } else {
      await tx.payrollCompensationProfile.update({
        where: { id: activeProfile.id },
        data: {
          targetAccrualSalary: this.decimal(salarySeed),
          officialNetSalary: this.decimal(salarySeed)
        }
      });
    }
  }

  private mapDepartment(value: 'service' | 'bar' | 'kitchen' | 'support' | 'other') {
    if (value === 'service') return 'SERVICE' as const;
    if (value === 'bar') return 'BAR' as const;
    if (value === 'kitchen') return 'KITCHEN' as const;
    if (value === 'support') return 'SUPPORT' as const;
    return 'OTHER' as const;
  }

  private async ensureExpenseCategory(companyId: string, name: string) {
    return this.prisma.financeCategory.upsert({
      where: { companyId_name: { companyId, name } },
      create: { companyId, name, type: 'EXPENSE' },
      update: { type: 'EXPENSE' }
    });
  }

  private validateSalaryFields(salaryType: 'fixed' | 'hourly', baseSalary: number | null, hourlyRate: number | null) {
    if (salaryType === 'fixed' && (baseSalary === null || baseSalary === undefined)) {
      throw new BadRequestException('baseSalary is required for fixed salary type');
    }
    if (salaryType === 'hourly' && (hourlyRate === null || hourlyRate === undefined)) {
      throw new BadRequestException('hourlyRate is required for hourly salary type');
    }
  }

  private async validateEmployeeRefs(companyId: string, roleId: string | null, profitCenterId: string | null) {
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

  private async requireEmployee(companyId: string, id: string) {
    const row = await this.prisma.employee.findUnique({ where: { id }, include: { role: true, profitCenter: true } });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Employee not found');
    return row;
  }

  private async requirePeriod(companyId: string, id: string) {
    const row = await this.prisma.payrollPeriod.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Payroll period not found');
    return row;
  }

  private async requirePeriodLine(companyId: string, periodId: string, lineId: string) {
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

  private decimal(value: number) {
    return new Prisma.Decimal(this.round2(value));
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
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
