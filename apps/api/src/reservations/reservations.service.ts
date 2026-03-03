import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import {
  reservationCustomerQuerySchema,
  reservationCustomerSchema,
  reservationQuerySchema,
  reservationSchema,
  reservationStatusSchema,
  reservationSummaryQuerySchema,
  reservationTagLinkSchema,
  reservationTagSchema
} from '@monocore/shared';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

@Injectable()
export class ReservationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async capabilities(userId: string, companyId: string) {
    const membership = await this.prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenException('Company membership required');
    }

    const keys = new Set(membership.roles.flatMap((row) => row.role.permissions.map((perm) => perm.permission.key)));
    return {
      permissions: Array.from(keys),
      manageCustomer: keys.has('module:reservation-core.customer.manage'),
      manageReservation: keys.has('module:reservation-core.reservation.manage'),
      readReservation: keys.has('module:reservation-core.reservation.read'),
      readReports: keys.has('module:reservation-core.reports.read')
    };
  }

  async listCustomers(companyId: string, query: unknown) {
    const parsed = reservationCustomerQuerySchema.parse(query);
    return this.prisma.customer.findMany({
      where: {
        companyId,
        ...(parsed.search
          ? {
              OR: [
                { firstName: { contains: parsed.search, mode: 'insensitive' } },
                { lastName: { contains: parsed.search, mode: 'insensitive' } },
                { phone: { contains: parsed.search, mode: 'insensitive' } },
                { email: { contains: parsed.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: {
        tags: { include: { tag: true }, orderBy: { createdAt: 'asc' } }
      },
      orderBy: [{ lastVisitAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createCustomer(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = reservationCustomerSchema.parse(payload);
    const row = await this.prisma.customer.create({
      data: {
        companyId,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ?? null,
        email: body.email ?? null,
        birthDate: body.birthDate ? this.parseDate(body.birthDate, false) : null,
        notes: body.notes ?? null
      },
      include: {
        tags: { include: { tag: true }, orderBy: { createdAt: 'asc' } }
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.reservation.customer.create', 'customer', row.id, body, ip, userAgent);
    return row;
  }

  async updateCustomer(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = reservationCustomerSchema.partial().parse(payload);
    const existing = await this.requireCustomer(companyId, id);

    const row = await this.prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.birthDate !== undefined ? { birthDate: body.birthDate ? this.parseDate(body.birthDate, false) : null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      },
      include: {
        tags: { include: { tag: true }, orderBy: { createdAt: 'asc' } }
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.reservation.customer.update', 'customer', row.id, body, ip, userAgent);
    return row;
  }

  async getCustomer(companyId: string, id: string) {
    const row = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true }, orderBy: { createdAt: 'asc' } },
        reservations: {
          include: { createdByUser: true },
          orderBy: [{ reservationDate: 'desc' }, { reservationTime: 'desc' }],
          take: 50
        }
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Customer not found');
    }
    return row;
  }

  listTags(companyId: string) {
    return this.prisma.customerTag.findMany({
      where: { companyId },
      orderBy: [{ name: 'asc' }]
    });
  }

  async createTag(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = reservationTagSchema.parse(payload);
    const row = await this.prisma.customerTag.create({
      data: { companyId, name: body.name }
    });
    await this.logCompany(actorUserId, companyId, 'company.reservation.tag.create', 'customer_tag', row.id, body, ip, userAgent);
    return row;
  }

  async linkCustomerTags(actorUserId: string, companyId: string, customerId: string, payload: unknown, ip?: string, userAgent?: string) {
    const customer = await this.requireCustomer(companyId, customerId);
    const body = reservationTagLinkSchema.parse(payload);
    for (const tagId of body.tagIds) {
      await this.requireTag(companyId, tagId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customerTagLink.deleteMany({
        where: {
          companyId,
          customerId: customer.id
        }
      });
      for (const tagId of body.tagIds) {
        await tx.customerTagLink.create({
          data: {
            companyId,
            customerId: customer.id,
            tagId
          }
        });
      }
    });

    const row = await this.getCustomer(companyId, customer.id);
    await this.logCompany(
      actorUserId,
      companyId,
      'company.reservation.customer.tags.update',
      'customer',
      customer.id,
      { tagIds: body.tagIds },
      ip,
      userAgent
    );
    return row;
  }

  async listReservations(companyId: string, query: unknown) {
    const parsed = reservationQuerySchema.parse(query);
    return this.prisma.reservation.findMany({
      where: {
        companyId,
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.date
          ? {
              reservationDate: {
                gte: this.parseDate(parsed.date, false),
                lte: this.parseDate(parsed.date, true)
              }
            }
          : {})
      },
      include: {
        customer: true,
        createdByUser: true
      },
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async createReservation(actorUserId: string, companyId: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = reservationSchema.parse(payload);
    if (body.customerId) {
      await this.requireCustomer(companyId, body.customerId);
    }

    const row = await this.prisma.reservation.create({
      data: {
        companyId,
        customerId: body.customerId ?? null,
        name: body.name,
        phone: body.phone ?? null,
        reservationDate: this.parseDate(body.reservationDate, false),
        reservationTime: this.parseTime(body.reservationDate, body.reservationTime),
        guestCount: body.guestCount,
        status: body.status ?? 'BOOKED',
        tableRef: body.tableRef ?? null,
        notes: body.notes ?? null,
        createdByUserId: actorUserId
      },
      include: {
        customer: true,
        createdByUser: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.reservation.create', 'reservation', row.id, body, ip, userAgent);
    return row;
  }

  async getReservation(companyId: string, id: string) {
    return this.requireReservation(companyId, id);
  }

  async updateReservation(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = reservationSchema.partial().parse(payload);
    const existing = await this.requireReservation(companyId, id);

    if (body.customerId) {
      await this.requireCustomer(companyId, body.customerId);
    }

    const row = await this.prisma.reservation.update({
      where: { id: existing.id },
      data: {
        ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.reservationDate !== undefined ? { reservationDate: this.parseDate(body.reservationDate, false) } : {}),
        ...(body.reservationTime !== undefined || body.reservationDate !== undefined
          ? {
              reservationTime: this.parseTime(
                body.reservationDate ?? this.toYmd(existing.reservationDate),
                body.reservationTime ?? this.toHm(existing.reservationTime)
              )
            }
          : {}),
        ...(body.guestCount !== undefined ? { guestCount: body.guestCount } : {}),
        ...(body.tableRef !== undefined ? { tableRef: body.tableRef } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      },
      include: {
        customer: true,
        createdByUser: true
      }
    });

    await this.logCompany(actorUserId, companyId, 'company.reservation.update', 'reservation', row.id, body, ip, userAgent);
    return row;
  }

  async updateStatus(actorUserId: string, companyId: string, id: string, payload: unknown, ip?: string, userAgent?: string) {
    const body = reservationStatusSchema.parse(payload);
    const existing = await this.requireReservation(companyId, id);
    const fromStatus = existing.status;
    const toStatus = body.newStatus;

    if (!this.canTransition(fromStatus, toStatus)) {
      throw new BadRequestException(`Invalid reservation status transition: ${fromStatus} -> ${toStatus}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({
        where: { id: existing.id },
        data: { status: toStatus },
        include: {
          customer: true,
          createdByUser: true
        }
      });

      if (toStatus === 'COMPLETED' && fromStatus !== 'COMPLETED' && reservation.customerId) {
        await tx.customer.update({
          where: { id: reservation.customerId },
          data: {
            visitCount: { increment: 1 },
            lastVisitAt: new Date()
          }
        });
      }

      return reservation;
    });

    await this.logCompany(
      actorUserId,
      companyId,
      'company.reservation.status.update',
      'reservation',
      result.id,
      { fromStatus, toStatus },
      ip,
      userAgent
    );
    return result;
  }

  async reservationSummary(companyId: string, query: unknown) {
    const parsed = reservationSummaryQuerySchema.parse(query);
    const from = this.parseDate(parsed.from, false);
    const to = this.parseDate(parsed.to, true);
    if (from > to) {
      throw new BadRequestException('Invalid date range');
    }

    const rows = await this.prisma.reservation.findMany({
      where: {
        companyId,
        reservationDate: {
          gte: from,
          lte: to
        }
      },
      select: {
        guestCount: true,
        status: true
      }
    });

    const totalReservations = rows.length;
    const noShowCount = rows.filter((row) => row.status === 'NO_SHOW').length;
    const completedCount = rows.filter((row) => row.status === 'COMPLETED').length;
    const avgGuestsPerReservation =
      totalReservations === 0 ? 0 : rows.reduce((sum, row) => sum + row.guestCount, 0) / totalReservations;
    const completionRate = totalReservations === 0 ? 0 : (completedCount / totalReservations) * 100;

    return {
      from: parsed.from,
      to: parsed.to,
      totalReservations,
      noShowCount,
      completionRate,
      avgGuestsPerReservation
    };
  }

  private canTransition(from: ReservationStatus, to: ReservationStatus) {
    if (from === to) return true;
    const graph: Record<ReservationStatus, ReservationStatus[]> = {
      BOOKED: ['CONFIRMED', 'CANCELED', 'NO_SHOW'],
      CONFIRMED: ['SEATED', 'CANCELED', 'NO_SHOW'],
      SEATED: ['COMPLETED', 'CANCELED'],
      COMPLETED: [],
      CANCELED: [],
      NO_SHOW: []
    };
    return graph[from].includes(to);
  }

  private parseDate(raw: string, endOfDay: boolean) {
    const value = new Date(`${raw}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`);
    if (Number.isNaN(value.valueOf())) {
      throw new BadRequestException('Invalid date value');
    }
    return value;
  }

  private parseTime(dateYmd: string, timeHm: string) {
    const value = new Date(`${dateYmd}T${timeHm}:00.000Z`);
    if (Number.isNaN(value.valueOf())) {
      throw new BadRequestException('Invalid reservation time');
    }
    return value;
  }

  private toYmd(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toHm(value: Date) {
    return value.toISOString().slice(11, 16);
  }

  private async requireCustomer(companyId: string, id: string) {
    const row = await this.prisma.customer.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Customer not found');
    }
    return row;
  }

  private async requireTag(companyId: string, id: string) {
    const row = await this.prisma.customerTag.findUnique({ where: { id } });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Customer tag not found');
    }
    return row;
  }

  private async requireReservation(companyId: string, id: string) {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        customer: true,
        createdByUser: true
      }
    });
    if (!row || row.companyId !== companyId) {
      throw new NotFoundException('Reservation not found');
    }
    return row;
  }

  private async logCompany(
    actorUserId: string,
    companyId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata: Record<string, unknown> = {},
    ip?: string,
    userAgent?: string
  ) {
    const safe: JsonObject = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined) continue;
      safe[key] = value as Prisma.InputJsonValue | null;
    }

    await this.audit.logCompany({
      actorUserId,
      companyId,
      action,
      entityType,
      entityId,
      metadata: safe,
      ip,
      userAgent
    });
  }
}
