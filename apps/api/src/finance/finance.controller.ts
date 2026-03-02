import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { FinanceService } from './finance.service.js';

@Controller('app-api/finance')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('finance-core')
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Get('capabilities')
  @RequirePermissions('module:finance-core.entry.read')
  capabilities(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.capabilities(req.user.id, req.companyId);
  }

  @Get('categories')
  @RequirePermissions('module:finance-core.entry.read')
  listCategories(@Req() req: Request & { companyId: string }) {
    return this.finance.listCategories(req.companyId);
  }

  @Post('categories')
  @RequirePermissions('module:finance-core.entry.create')
  createCategory(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createCategory(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('categories/:categoryId')
  @RequirePermissions('module:finance-core.entry.create')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateCategory(req.user.id, req.companyId, categoryId, body, req.ip, req.get('user-agent'));
  }

  @Delete('categories/:categoryId')
  @RequirePermissions('module:finance-core.entry.delete')
  deleteCategory(@Param('categoryId') categoryId: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deleteCategory(req.user.id, req.companyId, categoryId, req.ip, req.get('user-agent'));
  }

  @Get('entries')
  @RequirePermissions('module:finance-core.entry.read')
  listEntries(
    @Req() req: Request & { companyId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('counterpartyId') counterpartyId?: string,
    @Query('accountId') accountId?: string,
    @Query('profitCenterId') profitCenterId?: string
  ) {
    return this.finance.listEntries(req.companyId, { from, to, categoryId, counterpartyId, accountId, profitCenterId });
  }

  @Post('entries')
  @RequirePermissions('module:finance-core.entry.create')
  createEntry(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createEntry(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('entries/:entryId')
  @RequirePermissions('module:finance-core.entry.create')
  updateEntry(
    @Param('entryId') entryId: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateEntry(req.user.id, req.companyId, entryId, body, req.ip, req.get('user-agent'));
  }

  @Delete('entries/:entryId')
  @RequirePermissions('module:finance-core.entry.delete')
  deleteEntry(@Param('entryId') entryId: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deleteEntry(req.user.id, req.companyId, entryId, req.ip, req.get('user-agent'));
  }

  @Get('counterparties')
  @RequirePermissions('module:finance-core.entry.read')
  listCounterparties(@Req() req: Request & { companyId: string }, @Query('type') type?: string) {
    return this.finance.listCounterparties(req.companyId, type);
  }

  @Post('counterparties')
  @RequirePermissions('module:finance-core.counterparty.manage')
  createCounterparty(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createCounterparty(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('counterparties/:id')
  @RequirePermissions('module:finance-core.counterparty.manage')
  updateCounterparty(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateCounterparty(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Delete('counterparties/:id')
  @RequirePermissions('module:finance-core.counterparty.manage')
  deleteCounterparty(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deleteCounterparty(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('accounts')
  @RequirePermissions('module:finance-core.entry.read')
  listAccounts(@Req() req: Request & { companyId: string }) {
    return this.finance.listAccounts(req.companyId);
  }

  @Post('accounts')
  @RequirePermissions('module:finance-core.account.manage')
  createAccount(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createAccount(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('accounts/:id')
  @RequirePermissions('module:finance-core.account.manage')
  updateAccount(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateAccount(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Delete('accounts/:id')
  @RequirePermissions('module:finance-core.account.manage')
  deactivateAccount(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deactivateAccount(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('profit-centers')
  @RequirePermissions('module:finance-core.profit-center.read')
  listProfitCenters(@Req() req: Request & { companyId: string }, @Query('active') active?: string) {
    const activeFilter = active === undefined ? undefined : active === 'true';
    return this.finance.listProfitCenters(req.companyId, activeFilter);
  }

  @Post('profit-centers')
  @RequirePermissions('module:finance-core.profit-center.manage')
  createProfitCenter(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createProfitCenter(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('profit-centers/:id')
  @RequirePermissions('module:finance-core.profit-center.manage')
  updateProfitCenter(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateProfitCenter(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Delete('profit-centers/:id')
  @RequirePermissions('module:finance-core.profit-center.manage')
  deactivateProfitCenter(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deactivateProfitCenter(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('allocation-rules')
  @RequirePermissions('module:finance-core.allocation.read')
  listAllocationRules(@Req() req: Request & { companyId: string }) {
    return this.finance.listAllocationRules(req.companyId);
  }

  @Post('allocation-rules')
  @RequirePermissions('module:finance-core.allocation.manage')
  createAllocationRule(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createAllocationRule(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('allocation-rules/:id')
  @RequirePermissions('module:finance-core.allocation.manage')
  updateAllocationRule(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateAllocationRule(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('allocation-rules/:id/apply')
  @RequirePermissions('module:finance-core.allocation.apply')
  applyAllocationRule(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.applyAllocationRule(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('allocation-batches')
  @RequirePermissions('module:finance-core.allocation.read')
  listAllocationBatches(@Req() req: Request & { companyId: string }) {
    return this.finance.listAllocationBatches(req.companyId);
  }

  @Get('invoices')
  @RequirePermissions('module:finance-core.invoice.read')
  listInvoices(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.listInvoices(req.companyId, query);
  }

  @Post('invoices')
  @RequirePermissions('module:finance-core.invoice.manage')
  createInvoice(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createInvoice(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('invoices/:id')
  @RequirePermissions('module:finance-core.invoice.read')
  getInvoice(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.finance.getInvoice(req.companyId, id);
  }

  @Patch('invoices/:id')
  @RequirePermissions('module:finance-core.invoice.manage')
  updateInvoice(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateInvoice(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('invoices/:id/void')
  @RequirePermissions('module:finance-core.invoice.manage')
  voidInvoice(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.voidInvoice(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Delete('invoices/:id')
  @RequirePermissions('module:finance-core.invoice.manage')
  deleteInvoice(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.deleteInvoice(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('payments')
  @RequirePermissions('module:finance-core.payment.read')
  listPayments(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.listPayments(req.companyId, query);
  }

  @Post('payments')
  @RequirePermissions('module:finance-core.payment.manage')
  createPayment(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createPayment(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('payments/:id')
  @RequirePermissions('module:finance-core.payment.read')
  getPayment(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.finance.getPayment(req.companyId, id);
  }

  @Patch('payments/:id')
  @RequirePermissions('module:finance-core.payment.manage')
  updatePayment(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updatePayment(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('payments/:id/allocate')
  @RequirePermissions('module:finance-core.payment.manage')
  allocatePayment(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.allocatePayment(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('recurring')
  @RequirePermissions('module:finance-core.entry.read')
  listRecurring(@Req() req: Request & { companyId: string }) {
    return this.finance.listRecurringRules(req.companyId);
  }

  @Post('recurring')
  @RequirePermissions('module:finance-core.recurring.manage')
  createRecurring(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.createRecurringRule(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('recurring/:id')
  @RequirePermissions('module:finance-core.recurring.manage')
  updateRecurring(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.finance.updateRecurringRule(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('recurring/:id/run-now')
  @RequirePermissions('module:finance-core.recurring.manage')
  runRecurringNow(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.runRecurringNow(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('recurring/run-due')
  @RequirePermissions('module:finance-core.recurring.manage')
  runDueRecurring(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.finance.runDueRecurring(req.user.id, req.companyId, req.ip, req.get('user-agent'));
  }

  @Get('pnl/monthly')
  @RequirePermissions('module:finance-core.entry.read')
  monthlyPnl(@Req() req: Request & { companyId: string }) {
    return this.finance.monthlyPnl(req.companyId);
  }

  @Get('reports/pnl')
  @RequirePermissions('module:finance-core.reports.read')
  pnlReport(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.pnlReport(req.companyId, query);
  }

  @Get('reports/cashflow')
  @RequirePermissions('module:finance-core.reports.read')
  cashflowReport(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.cashflowReport(req.companyId, query);
  }

  @Get('reports/pnl-by-profit-center')
  @RequirePermissions('module:finance-core.reports.profit-center.read')
  pnlByProfitCenter(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.pnlByProfitCenter(req.companyId, query);
  }

  @Get('reports/profit-center-comparison')
  @RequirePermissions('module:finance-core.reports.profit-center.read')
  profitCenterComparison(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.profitCenterComparison(req.companyId, query);
  }

  @Get('reports/aging')
  @RequirePermissions('module:finance-core.reports.aging.read')
  agingReport(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.agingReport(req.companyId, query);
  }

  @Get('reports/counterparty-balance')
  @RequirePermissions('module:finance-core.payment.read')
  counterpartyBalance(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.finance.counterpartyBalanceReport(req.companyId, query);
  }
}
