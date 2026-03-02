import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { RecipeService } from './recipe.service.js';

@Controller('app-api/recipes')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('recipe-core')
export class RecipeController {
  constructor(@Inject(RecipeService) private readonly recipe: RecipeService) {}

  @Get('capabilities')
  @RequirePermissions('module:recipe-core.recipe.read')
  capabilities(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.recipe.capabilities(req.user.id, req.companyId);
  }

  @Get('products')
  @RequirePermissions('module:recipe-core.recipe.read')
  products(@Req() req: Request & { companyId: string }) {
    return this.recipe.listProducts(req.companyId);
  }

  @Post('products')
  @RequirePermissions('module:recipe-core.product.manage')
  createProduct(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.recipe.createProduct(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('products/:id')
  @RequirePermissions('module:recipe-core.product.manage')
  updateProduct(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.recipe.updateProduct(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('recipes')
  @RequirePermissions('module:recipe-core.recipe.read')
  listRecipes(@Req() req: Request & { companyId: string }) {
    return this.recipe.listRecipes(req.companyId);
  }

  @Post('recipes')
  @RequirePermissions('module:recipe-core.recipe.manage')
  createRecipe(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.recipe.createRecipe(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('recipes/:id')
  @RequirePermissions('module:recipe-core.recipe.manage')
  updateRecipe(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request & { user: { id: string }; companyId: string }
  ) {
    return this.recipe.updateRecipe(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('recipes/:productId')
  @RequirePermissions('module:recipe-core.recipe.read')
  recipeByProduct(@Param('productId') productId: string, @Req() req: Request & { companyId: string }) {
    return this.recipe.getRecipeByProduct(req.companyId, productId);
  }
}
