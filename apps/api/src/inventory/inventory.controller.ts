import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { InventoryService } from './inventory.service.js';

@Controller('app-api/inventory')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('inventory-core')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Get('capabilities')
  @RequirePermissions('module:inventory-core.movement.read')
  capabilities(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.capabilities(req.user.id, req.companyId);
  }

  @Get('warehouses')
  @RequirePermissions('module:inventory-core.movement.read')
  listWarehouses(@Req() req: Request & { companyId: string }) {
    return this.inventory.listWarehouses(req.companyId);
  }

  @Post('warehouses')
  @RequirePermissions('module:inventory-core.warehouse.manage')
  createWarehouse(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createWarehouse(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('warehouses/:id')
  @RequirePermissions('module:inventory-core.warehouse.manage')
  updateWarehouse(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateWarehouse(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('items')
  @RequirePermissions('module:inventory-core.items.read')
  listItems(@Req() req: Request & { companyId: string }, @Query() query: unknown) {
    return this.inventory.listItems(req.companyId, query);
  }

  @Get('items/export.csv')
  @RequirePermissions('module:inventory-core.items.read')
  async exportItemsCsv(
    @Req() req: Request & { user: { id: string }; companyId: string },
    @Query() query: unknown,
    @Res({ passthrough: true }) res: Response
  ) {
    const csv = await this.inventory.exportItemsCsv(req.user.id, req.companyId, query, req.ip, req.get('user-agent'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-items.csv"');
    return csv;
  }

  @Get('items/export.xlsx')
  @RequirePermissions('module:inventory-core.items.read')
  async exportItemsXlsx(
    @Req() req: Request & { user: { id: string }; companyId: string },
    @Query() query: unknown,
    @Res() res: Response
  ) {
    const buffer = await this.inventory.exportItemsXlsx(req.user.id, req.companyId, query, req.ip, req.get('user-agent'));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-items.xlsx"');
    res.send(buffer);
  }

  @Get('items/import/template.csv')
  @RequirePermissions('module:inventory-core.items.manage')
  downloadItemsImportTemplateCsv(@Res({ passthrough: true }) res: Response) {
    const csv = this.inventory.getItemsImportTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-items-template.csv"');
    return csv;
  }

  @Get('items/import/template.xlsx')
  @RequirePermissions('module:inventory-core.items.manage')
  downloadItemsImportTemplateXlsx(@Res() res: Response) {
    const buffer = this.inventory.getItemsImportTemplateXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-items-template.xlsx"');
    res.send(buffer);
  }

  @Post('items/import/preview')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions('module:inventory-core.items.manage')
  previewItemsImport(
    @UploadedFile() file: { originalname?: string; buffer: Buffer } | undefined,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.previewItemImport(req.user.id, req.companyId, file, req.ip, req.get('user-agent'));
  }

  @Post('items/import/confirm')
  @RequirePermissions('module:inventory-core.items.manage')
  confirmItemsImport(
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.confirmItemImport(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('items')
  @RequirePermissions('module:inventory-core.items.manage')
  createItem(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createItem(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('items/:id')
  @RequirePermissions('module:inventory-core.items.manage')
  updateItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateItem(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Patch('items/:id/cost')
  @RequirePermissions('module:inventory-core.items.manage')
  updateItemCost(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateItemCost(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('items/:id/activate')
  @RequirePermissions('module:inventory-core.items.manage')
  activateItem(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.activateItem(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('items/:id/deactivate')
  @RequirePermissions('module:inventory-core.items.manage')
  deactivateItem(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.deactivateItem(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('movements')
  @RequirePermissions('module:inventory-core.movement.read')
  listMovements(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.inventory.listMovements(req.companyId, query);
  }

  @Post('movements')
  @RequirePermissions('module:inventory-core.movement.manage')
  createMovement(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createMovement(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('transfer')
  @RequirePermissions('module:inventory-core.movement.manage')
  transfer(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.transfer(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('stock-balance')
  @RequirePermissions('module:inventory-core.movement.read')
  stockBalance(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.inventory.stockBalance(req.companyId, query);
  }

  @Get('stock-counts')
  @RequirePermissions('module:inventory-core.stock-count.read')
  listStockCounts(@Req() req: Request & { companyId: string }) {
    return this.inventory.listStockCounts(req.companyId);
  }

  @Post('stock-counts')
  @RequirePermissions('module:inventory-core.stock-count.manage')
  createStockCount(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createStockCountSession(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Get('stock-counts/:id')
  @RequirePermissions('module:inventory-core.stock-count.read')
  getStockCount(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.inventory.getStockCountSession(req.companyId, id);
  }

  @Patch('stock-counts/:id/lines')
  @RequirePermissions('module:inventory-core.stock-count.manage')
  upsertStockCountLine(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.upsertStockCountLine(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Delete('stock-counts/:id/lines/:lineId')
  @RequirePermissions('module:inventory-core.stock-count.manage')
  deleteStockCountLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.deleteStockCountLine(req.user.id, req.companyId, id, lineId, req.ip, req.get('user-agent'));
  }

  @Post('stock-counts/:id/post')
  @RequirePermissions('module:inventory-core.stock-count.manage')
  postStockCount(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.postStockCountSession(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('suppliers')
  @RequirePermissions('module:inventory-core.suppliers.read')
  listSuppliers(@Req() req: Request & { companyId: string }, @Query() query: unknown) {
    return this.inventory.listSuppliers(req.companyId, query);
  }

  @Post('suppliers')
  @RequirePermissions('module:inventory-core.suppliers.manage')
  createSupplier(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createSupplier(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('suppliers/:id')
  @RequirePermissions('module:inventory-core.suppliers.manage')
  updateSupplier(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateSupplier(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('suppliers/:id/activate')
  @RequirePermissions('module:inventory-core.suppliers.manage')
  activateSupplier(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.activateSupplier(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('suppliers/:id/deactivate')
  @RequirePermissions('module:inventory-core.suppliers.manage')
  deactivateSupplier(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.deactivateSupplier(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Delete('suppliers/:id')
  @RequirePermissions('module:inventory-core.suppliers.manage')
  deleteSupplier(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.deleteSupplier(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get('brands')
  @RequirePermissions('module:inventory-core.brands.read')
  listBrands(@Req() req: Request & { companyId: string }, @Query() query: unknown) {
    return this.inventory.listBrands(req.companyId, query);
  }

  @Post('brands')
  @RequirePermissions('module:inventory-core.brands.manage')
  createBrand(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.createBrand(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('brands/:id')
  @RequirePermissions('module:inventory-core.brands.manage')
  updateBrand(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.updateBrand(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('brands/:id/activate')
  @RequirePermissions('module:inventory-core.brands.manage')
  activateBrand(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.activateBrand(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('brands/:id/deactivate')
  @RequirePermissions('module:inventory-core.brands.manage')
  deactivateBrand(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.deactivateBrand(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Delete('brands/:id')
  @RequirePermissions('module:inventory-core.brands.manage')
  deleteBrand(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.inventory.deleteBrand(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post('brands/:id/link-supplier')
  @RequirePermissions('module:inventory-core.brands.manage')
  linkBrandSupplier(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.linkBrandSupplier(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post('brands/:id/unlink-supplier')
  @RequirePermissions('module:inventory-core.brands.manage')
  unlinkBrandSupplier(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.inventory.unlinkBrandSupplier(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }
}
