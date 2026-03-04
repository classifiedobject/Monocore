import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  payrollEmployeeSchema,
  payrollPeriodSchema,
  payrollWorkLogQuerySchema,
  payrollWorkLogSchema
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
