import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { ReservationsService } from './reservations.service.js';

@Controller('app-api/reservations')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('reservation-core')
export class ReservationsController {
  constructor(@Inject(ReservationsService) private readonly reservations: ReservationsService) {}

  @Get('capabilities')
  @RequirePermissions('module:reservation-core.reservation.read')
  capabilities(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.capabilities(req.user.id, req.companyId);
  }

  @Get('customers')
  @RequirePermissions('module:reservation-core.reservation.read')
  listCustomers(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.reservations.listCustomers(req.companyId, query);
  }

  @Post('customers')
  @RequirePermissions('module:reservation-core.customer.manage')
  createCustomer(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.createCustomer(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('customers/:id')
  @RequirePermissions('module:reservation-core.customer.manage')
  updateCustomer(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.updateCustomer(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('customers/:id')
  @RequirePermissions('module:reservation-core.reservation.read')
  getCustomer(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.reservations.getCustomer(req.companyId, id);
  }

  @Get('customer-tags')
  @RequirePermissions('module:reservation-core.reservation.read')
  listTags(@Req() req: Request & { companyId: string }) {
    return this.reservations.listTags(req.companyId);
  }

  @Post('customer-tags')
  @RequirePermissions('module:reservation-core.customer.manage')
  createTag(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.createTag(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('customers/:id/tags')
  @RequirePermissions('module:reservation-core.customer.manage')
  linkTags(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.linkCustomerTags(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('reservations')
  @RequirePermissions('module:reservation-core.reservation.read')
  listReservations(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.reservations.listReservations(req.companyId, query);
  }

  @Post('reservations')
  @RequirePermissions('module:reservation-core.reservation.manage')
  createReservation(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.createReservation(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('reservations/:id')
  @RequirePermissions('module:reservation-core.reservation.read')
  getReservation(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.reservations.getReservation(req.companyId, id);
  }

  @Patch('reservations/:id')
  @RequirePermissions('module:reservation-core.reservation.manage')
  updateReservation(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.updateReservation(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('reservations/:id/status')
  @RequirePermissions('module:reservation-core.reservation.manage')
  updateStatus(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.reservations.updateStatus(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('reports/reservation-summary')
  @RequirePermissions('module:reservation-core.reports.read')
  reservationSummary(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.reservations.reservationSummary(req.companyId, query);
  }
}
