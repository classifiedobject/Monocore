import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  payrollEmployeeSchema,
  payrollPeriodSchema,
  payrollWorkLogQuerySchema,
  payrollWorkLogSchema,
  tipAdvanceSchema,
  tipConfigurationSchema,
  tipDailyInputSchema,
  tipDepartmentOverrideSchema,
  tipPoolSchema,
  tipWeekSchema
} from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

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
        salaryType: body.salaryType === 'fixed' ? 'FIXED' : 'HOURLY',
        baseSalary: body.baseSalary === null || body.baseSalary === undefined ? null : new Prisma.Decimal(body.baseSalary),
        hourlyRate: body.hourlyRate === null || body.hourlyRate === undefined ? null : new Prisma.Decimal(body.hourlyRate),
        tipWeight: body.tipWeight === undefined ? new Prisma.Decimal(1) : new Prisma.Decimal(body.tipWeight),
        department: body.department ? this.mapDepartment(body.department) : 'SERVICE',
        isActive: body.isActive ?? true
      },
      include: { role: true, profitCenter: true }
    });

    await this.logCompany(actorUserId, companyId, 'company.payroll.employee.create', 'employee', row.id, body, ip, userAgent);
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

    const row = await this.prisma.employee.update({
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

    await this.logCompany(actorUserId, companyId, 'company.payroll.employee.update', 'employee', row.id, body, ip, userAgent);
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

    await this.logCompany(actorUserId, companyId, 'company.payroll.worklog.create', 'worklog', row.id, body, ip, userAgent);
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

    await this.logCompany(actorUserId, companyId, 'company.payroll.period.create', 'payroll_period', row.id, body, ip, userAgent);
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

    await this.logCompany(actorUserId, companyId, 'company.payroll.period.calculate', 'payroll_period', period.id, { totalGross: result.totalGross }, ip, userAgent);
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

  async listTips(companyId: string) {
    return this.prisma.tipPool.findMany({
      where: { companyId },
      include: {
        distributions: {
          include: { employee: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { periodStart: 'desc' }
    });
  }

  async createTipPool(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = tipPoolSchema.parse(payload);
    const periodStart = this.parseDate(body.periodStart, false);
    const periodEnd = this.parseDate(body.periodEnd, true);
    if (periodStart > periodEnd) throw new BadRequestException('periodStart must be before periodEnd');

    const employees = await this.prisma.employee.findMany({ where: { companyId, isActive: true } });
    if (employees.length === 0) throw new BadRequestException('No active employees found for tip distribution');

    const totalTips = body.totalTips;

    const worklogs = body.distributionMethod === 'hours_weighted'
      ? await this.prisma.workLog.findMany({
          where: {
            companyId,
            date: { gte: periodStart, lte: periodEnd },
            employeeId: { in: employees.map((row) => row.id) }
          }
        })
      : [];

    const hoursByEmployee = new Map<string, number>();
    for (const row of worklogs) {
      hoursByEmployee.set(row.employeeId, (hoursByEmployee.get(row.employeeId) ?? 0) + Number(row.hoursWorked.toString()));
    }

    const dist = this.buildDistribution(employees.map((row) => row.id), totalTips, body.distributionMethod, hoursByEmployee);

    const pool = await this.prisma.$transaction(async (tx) => {
      const createdPool = await tx.tipPool.create({
        data: {
          companyId,
          periodStart,
          periodEnd,
          totalTips: new Prisma.Decimal(totalTips),
          distributionMethod: body.distributionMethod === 'equal' ? 'EQUAL' : 'HOURS_WEIGHTED'
        }
      });

      for (const item of dist) {
        await tx.tipDistribution.create({
          data: {
            companyId,
            tipPoolId: createdPool.id,
            employeeId: item.employeeId,
            amount: new Prisma.Decimal(item.amount)
          }
        });
      }

      return tx.tipPool.findUniqueOrThrow({
        where: { id: createdPool.id },
        include: { distributions: { include: { employee: true } } }
      });
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.tip_pool.create',
      'tip_pool',
      pool.id,
      {
        totalTips,
        distributionMethod: body.distributionMethod,
        distributions: dist.length
      },
      ip,
      userAgent
    );

    return pool;
  }

  async getTipConfiguration(companyId: string) {
    const row = await this.prisma.tipConfiguration.findUnique({ where: { companyId } });
    if (row) return row;
    return this.prisma.tipConfiguration.create({
      data: {
        companyId,
        serviceRate: new Prisma.Decimal(0.1),
        serviceTaxDeductionRate: new Prisma.Decimal(0.4),
        visaTaxDeductionRate: new Prisma.Decimal(0.4),
        defaultWastePoints: new Prisma.Decimal(0),
        allowDepartmentSubPool: false
      }
    });
  }

  async upsertTipConfiguration(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = tipConfigurationSchema.parse(payload);
    const row = await this.prisma.tipConfiguration.upsert({
      where: { companyId },
      create: {
        companyId,
        serviceRate: new Prisma.Decimal(body.serviceRate),
        serviceTaxDeductionRate: new Prisma.Decimal(body.serviceTaxDeductionRate),
        visaTaxDeductionRate: new Prisma.Decimal(body.visaTaxDeductionRate),
        defaultWastePoints: new Prisma.Decimal(body.defaultWastePoints),
        allowDepartmentSubPool: body.allowDepartmentSubPool
      },
      update: {
        serviceRate: new Prisma.Decimal(body.serviceRate),
        serviceTaxDeductionRate: new Prisma.Decimal(body.serviceTaxDeductionRate),
        visaTaxDeductionRate: new Prisma.Decimal(body.visaTaxDeductionRate),
        defaultWastePoints: new Prisma.Decimal(body.defaultWastePoints),
        allowDepartmentSubPool: body.allowDepartmentSubPool
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.payroll.tip.config.update', 'tip_configuration', row.id, body, ip, userAgent);
    return row;
  }

  async listTipDailyInputs(companyId: string, query: Record<string, string | undefined>) {
    return this.prisma.tipDailyInput.findMany({
      where: {
        companyId,
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: this.parseDate(query.from, false) } : {}),
                ...(query.to ? { lte: this.parseDate(query.to, true) } : {})
              }
            }
          : {})
      },
      orderBy: { date: 'desc' }
    });
  }

  async upsertTipDailyInput(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = tipDailyInputSchema.parse(payload);
    const config = await this.getTipConfiguration(companyId);
    const date = this.parseDate(body.date, false);
    const serviceRevenue = this.round2(body.grossRevenue - body.discounts - body.comps - body.wastageSales);
    const serviceFee = serviceRevenue > 0 ? this.round2(serviceRevenue / (1 + Number(config.serviceRate))) : 0;
    const taxDeduction = this.round2(serviceFee * Number(config.serviceTaxDeductionRate));
    const netService = this.round2(serviceFee - taxDeduction);
    const visaNet = this.round2(body.visaTipsGross - body.visaTipsGross * Number(config.visaTaxDeductionRate));

    const row = await this.prisma.tipDailyInput.upsert({
      where: { companyId_date: { companyId, date } },
      create: {
        companyId,
        date,
        grossRevenue: new Prisma.Decimal(body.grossRevenue),
        discounts: new Prisma.Decimal(body.discounts),
        comps: new Prisma.Decimal(body.comps),
        wastageSales: new Prisma.Decimal(body.wastageSales),
        serviceRevenueCalculated: new Prisma.Decimal(serviceRevenue),
        netServiceRevenue: new Prisma.Decimal(serviceRevenue),
        netServiceFee: new Prisma.Decimal(netService),
        cashTips: new Prisma.Decimal(body.cashTips),
        visaTipsGross: new Prisma.Decimal(body.visaTipsGross),
        visaTipsNet: new Prisma.Decimal(visaNet),
        expenseAdjustments: new Prisma.Decimal(body.expenseAdjustments)
      },
      update: {
        grossRevenue: new Prisma.Decimal(body.grossRevenue),
        discounts: new Prisma.Decimal(body.discounts),
        comps: new Prisma.Decimal(body.comps),
        wastageSales: new Prisma.Decimal(body.wastageSales),
        serviceRevenueCalculated: new Prisma.Decimal(serviceRevenue),
        netServiceRevenue: new Prisma.Decimal(serviceRevenue),
        netServiceFee: new Prisma.Decimal(netService),
        cashTips: new Prisma.Decimal(body.cashTips),
        visaTipsGross: new Prisma.Decimal(body.visaTipsGross),
        visaTipsNet: new Prisma.Decimal(visaNet),
        expenseAdjustments: new Prisma.Decimal(body.expenseAdjustments)
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.payroll.tip.daily_input.upsert', 'tip_daily_input', row.id, body, ip, userAgent);
    return row;
  }

  async listTipWeeks(companyId: string) {
    return this.prisma.tipWeek.findMany({
      where: { companyId },
      include: {
        advances: { include: { employee: true }, orderBy: { createdAt: 'desc' } },
        distributions: { include: { employee: true }, orderBy: { createdAt: 'asc' } },
        departmentOverrides: true
      },
      orderBy: { periodStart: 'desc' }
    });
  }

  async createTipWeek(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = tipWeekSchema.parse(payload);
    const periodStart = this.parseDate(body.periodStart, false);
    const periodEnd = this.parseDate(body.periodEnd, true);
    if (periodStart > periodEnd) throw new BadRequestException('periodStart must be before periodEnd');

    const config = await this.getTipConfiguration(companyId);
    const row = await this.prisma.tipWeek.create({
      data: {
        companyId,
        periodStart,
        periodEnd,
        serviceRateUsed: new Prisma.Decimal(body.serviceRateUsed ?? Number(config.serviceRate)),
        wastePointsUsed: new Prisma.Decimal(body.wastePointsUsed ?? Number(config.defaultWastePoints)),
        status: 'DRAFT',
        payableDate: body.payableDate ? this.parseDate(body.payableDate, false) : null
      },
      include: { advances: true, distributions: true, departmentOverrides: true }
    });
    await this.logCompany(actorUserId, companyId, 'company.payroll.tip.week.create', 'tip_week', row.id, body, ip, userAgent);
    return row;
  }

  async setTipDepartmentOverride(
    actorUserId: string,
    companyId: string,
    tipWeekId: string,
    payload: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const body = tipDepartmentOverrideSchema.parse(payload);
    const week = await this.requireTipWeek(companyId, tipWeekId);
    if (week.status === 'LOCKED' || week.status === 'PAID') {
      throw new BadRequestException('Cannot change overrides after lock');
    }
    const row = await this.prisma.tipDepartmentOverride.upsert({
      where: { tipWeekId_department: { tipWeekId: week.id, department: this.mapDepartment(body.department) } },
      create: {
        companyId,
        tipWeekId: week.id,
        department: this.mapDepartment(body.department),
        overrideWeight: new Prisma.Decimal(body.overrideWeight)
      },
      update: {
        overrideWeight: new Prisma.Decimal(body.overrideWeight)
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.payroll.tip.waste_override', 'tip_department_override', row.id, body, ip, userAgent);
    return row;
  }

  async createTipAdvance(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = tipAdvanceSchema.parse(payload);
    await this.requireEmployee(companyId, body.employeeId);
    const week = await this.requireTipWeek(companyId, body.tipWeekId);
    if (week.status === 'LOCKED' || week.status === 'PAID') {
      throw new BadRequestException('Cannot add advance after lock');
    }
    const row = await this.prisma.tipAdvance.create({
      data: {
        companyId,
        tipWeekId: week.id,
        employeeId: body.employeeId,
        amount: new Prisma.Decimal(body.amount),
        approvedByUserId: actorUserId
      },
      include: { employee: true }
    });
    await this.logCompany(actorUserId, companyId, 'company.payroll.tip.advance.create', 'tip_advance', row.id, body, ip, userAgent);
    return row;
  }

  async calculateTipWeek(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const week = await this.requireTipWeek(companyId, id);
    if (week.status === 'LOCKED' || week.status === 'PAID') {
      throw new BadRequestException('Tip week is locked');
    }

    const [dailyInputs, employees, advances, overrides] = await Promise.all([
      this.prisma.tipDailyInput.findMany({ where: { companyId, date: { gte: week.periodStart, lte: week.periodEnd } } }),
      this.prisma.employee.findMany({ where: { companyId, isActive: true } }),
      this.prisma.tipAdvance.findMany({ where: { companyId, tipWeekId: week.id } }),
      this.prisma.tipDepartmentOverride.findMany({ where: { companyId, tipWeekId: week.id } })
    ]);

    const sums = dailyInputs.reduce(
      (acc, row) => {
        acc.netService += Number(row.netServiceFee);
        acc.cashTips += Number(row.cashTips);
        acc.visaTipsNet += Number(row.visaTipsNet);
        acc.expenseAdjustments += Number(row.expenseAdjustments);
        return acc;
      },
      { netService: 0, cashTips: 0, visaTipsNet: 0, expenseAdjustments: 0 }
    );

    const totalPoolGross = this.round2(sums.netService + sums.cashTips + sums.visaTipsNet);
    const totalPoolNet = this.round2(totalPoolGross - sums.expenseAdjustments);

    const overrideMap = new Map(overrides.map((row) => [row.department, Number(row.overrideWeight)]));
    const weights = employees.map((employee) => {
      const base = Number(employee.tipWeight);
      const override = overrideMap.get(employee.department);
      return {
        employeeId: employee.id,
        weight: override !== undefined ? override : base
      };
    });

    const totalPoints = this.round2(weights.reduce((sum, row) => sum + row.weight, 0) + Number(week.wastePointsUsed));
    const pointValue = totalPoints > 0 ? this.round2(totalPoolNet / totalPoints) : 0;

    const advanceByEmployee = new Map<string, number>();
    for (const row of advances) {
      advanceByEmployee.set(row.employeeId, this.round2((advanceByEmployee.get(row.employeeId) ?? 0) + Number(row.amount)));
    }

    const distributions = this.splitByWeights(weights, totalPoolNet).map((row) => {
      const advance = advanceByEmployee.get(row.employeeId) ?? 0;
      const netShare = this.round2(Math.max(0, row.amount - advance));
      return {
        employeeId: row.employeeId,
        tipWeightUsed: weights.find((w) => w.employeeId === row.employeeId)?.weight ?? 0,
        grossShare: row.amount,
        advanceDeducted: advance,
        netShare
      };
    });

    const totalDistributed = this.round2(distributions.reduce((sum, row) => sum + row.netShare, 0));

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.tipWeekDistribution.deleteMany({ where: { companyId, tipWeekId: week.id } });
      for (const row of distributions) {
        await tx.tipWeekDistribution.create({
          data: {
            companyId,
            tipWeekId: week.id,
            employeeId: row.employeeId,
            tipWeightUsed: new Prisma.Decimal(row.tipWeightUsed),
            grossShare: new Prisma.Decimal(row.grossShare),
            advanceDeducted: new Prisma.Decimal(row.advanceDeducted),
            netShare: new Prisma.Decimal(row.netShare)
          }
        });
      }
      return tx.tipWeek.update({
        where: { id: week.id },
        data: {
          totalPoolGross: new Prisma.Decimal(totalPoolGross),
          totalPoolNet: new Prisma.Decimal(totalPoolNet),
          totalDistributed: new Prisma.Decimal(totalDistributed),
          status: 'CALCULATED'
        },
        include: {
          advances: { include: { employee: true } },
          distributions: { include: { employee: true } },
          departmentOverrides: true
        }
      });
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.payroll.tip.week.calculate',
      'tip_week',
      week.id,
      {
        totals: { totalPoolGross, totalPoolNet, totalDistributed, totalPoints, pointValue },
        counts: { dailyInputs: dailyInputs.length, employees: employees.length, distributions: distributions.length }
      },
      ip,
      userAgent
    );

    return result;
  }

  async lockTipWeek(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const week = await this.requireTipWeek(companyId, id);
    if (week.status === 'PAID') throw new BadRequestException('Already paid');
    if (week.status === 'DRAFT') throw new BadRequestException('Calculate before lock');
    const row = await this.prisma.tipWeek.update({
      where: { id: week.id },
      data: { status: 'LOCKED' },
      include: {
        advances: { include: { employee: true } },
        distributions: { include: { employee: true } },
        departmentOverrides: true
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.payroll.tip.week.lock', 'tip_week', week.id, { status: 'LOCKED' }, ip, userAgent);
    return row;
  }

  async markTipWeekPaid(actorUserId: string, companyId: string, id: string, ip?: string, userAgent?: string) {
    const week = await this.requireTipWeek(companyId, id);
    if (week.status !== 'LOCKED') throw new BadRequestException('Tip week must be locked before payment');
    const row = await this.prisma.tipWeek.update({
      where: { id: week.id },
      data: { status: 'PAID' },
      include: {
        advances: { include: { employee: true } },
        distributions: { include: { employee: true } },
        departmentOverrides: true
      }
    });
    await this.logCompany(actorUserId, companyId, 'company.payroll.tip.week.payment', 'tip_week', week.id, { status: 'PAID' }, ip, userAgent);
    return row;
  }

  private buildDistribution(
    employeeIds: string[],
    totalTips: number,
    method: 'equal' | 'hours_weighted',
    hoursByEmployee: Map<string, number>
  ) {
    if (employeeIds.length === 0) return [];

    if (method === 'equal') {
      return this.splitByWeights(
        employeeIds.map((employeeId) => ({ employeeId, weight: 1 })),
        totalTips
      );
    }

    const weights = employeeIds.map((employeeId) => ({ employeeId, weight: hoursByEmployee.get(employeeId) ?? 0 }));
    const totalHours = weights.reduce((sum, row) => sum + row.weight, 0);
    if (totalHours <= 0) {
      return this.splitByWeights(
        employeeIds.map((employeeId) => ({ employeeId, weight: 1 })),
        totalTips
      );
    }
    return this.splitByWeights(weights, totalTips);
  }

  private splitByWeights(rows: Array<{ employeeId: string; weight: number }>, total: number) {
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    let remaining = this.round2(total);

    return rows.map((row, index) => {
      if (index === rows.length - 1) {
        return { employeeId: row.employeeId, amount: this.round2(remaining) };
      }

      const portion = totalWeight > 0 ? (total * row.weight) / totalWeight : 0;
      const amount = this.round2(portion);
      remaining = this.round2(remaining - amount);
      return { employeeId: row.employeeId, amount };
    });
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

  private async requireTipWeek(companyId: string, id: string) {
    const row = await this.prisma.tipWeek.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) throw new NotFoundException('Tip week not found');
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
