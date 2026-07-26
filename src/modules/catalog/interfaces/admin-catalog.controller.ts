import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  FoodCategoryAdminDto,
  MenuCategoryDto,
  MenuItemDto,
  ModifierGroupDto,
  ModifierOptionDto,
  ModuleCategoryAdminDto,
  ModuleCategoryListQueryDto,
  OptionalModuleTypeQueryDto,
  ProductAdminDto,
  UpdateFoodCategoryAdminDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
  UpdateModifierGroupDto,
  UpdateModifierOptionDto,
  UpdateModuleCategoryAdminDto,
  UpdateProductAdminDto,
} from '../dto/catalog.dto';
import { AdminMenuService } from '../use-cases/admin-menu.service';
import { AdminProductsService } from '../use-cases/admin-products.service';
import { FoodCategoriesService } from '../use-cases/food-categories.service';
import { ModuleCategoriesService } from '../use-cases/module-categories.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Admin Catalog')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminCatalogController {
  public constructor(
    private readonly categories: FoodCategoriesService,
    private readonly moduleCategories: ModuleCategoriesService,
    private readonly menus: AdminMenuService,
    private readonly products: AdminProductsService,
  ) {}

  @Get('food-categories')
  @RequirePermission('read', 'catalog')
  public listFoodCategories() {
    return this.categories.listAdmin();
  }

  @Post('food-categories')
  @RequirePermission('manage', 'catalog')
  public createFoodCategory(@Body() body: FoodCategoryAdminDto) {
    return this.categories.create(body);
  }

  @Patch('food-categories/:categoryId')
  @RequirePermission('manage', 'catalog')
  public updateFoodCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateFoodCategoryAdminDto,
  ) {
    return this.categories.update(categoryId, body);
  }

  @Delete('food-categories/:categoryId')
  @RequirePermission('manage', 'catalog')
  public deleteFoodCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.categories.softDelete(categoryId);
  }

  @Get('module-categories')
  @RequirePermission('read', 'catalog')
  public listModuleCategories(@Query() query: ModuleCategoryListQueryDto) {
    return this.moduleCategories.listAdmin(query.moduleType);
  }

  @Post('module-categories')
  @RequirePermission('manage', 'catalog')
  public createModuleCategory(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: ModuleCategoryAdminDto,
  ) {
    return this.moduleCategories.create(body, principal.id);
  }

  @Patch('module-categories/:categoryId')
  @RequirePermission('manage', 'catalog')
  public updateModuleCategory(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateModuleCategoryAdminDto,
  ) {
    return this.moduleCategories.update(categoryId, body, principal.id);
  }

  @Delete('module-categories/:categoryId')
  @RequirePermission('manage', 'catalog')
  public deleteModuleCategory(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() query: OptionalModuleTypeQueryDto,
  ) {
    return this.moduleCategories.softDelete(
      categoryId,
      query.moduleType,
      principal.id,
    );
  }

  @Get('stores/:storeId/products')
  @RequirePermission('read', 'catalog')
  public listProducts(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.products.list(storeId);
  }

  @Get('stores/:storeId/products/:productId')
  @RequirePermission('read', 'catalog')
  public getProduct(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.products.get(storeId, productId);
  }

  @Post('stores/:storeId/products')
  @RequirePermission('manage', 'catalog')
  public createProduct(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: ProductAdminDto,
  ) {
    return this.products.create(storeId, body, principal.id);
  }

  @Patch('stores/:storeId/products/:productId')
  @RequirePermission('manage', 'catalog')
  public updateProduct(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: UpdateProductAdminDto,
  ) {
    return this.products.update(storeId, productId, body, principal.id);
  }

  @Delete('stores/:storeId/products/:productId')
  @RequirePermission('manage', 'catalog')
  public deleteProduct(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.products.softDelete(storeId, productId, principal.id);
  }

  @Get('stores/:storeId/menu')
  @RequirePermission('read', 'catalog')
  public listMenu(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.menus.list(storeId);
  }

  @Get('stores/:storeId/menu-categories')
  @RequirePermission('read', 'catalog')
  public listMenuCategories(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.menus.listCategories(storeId);
  }

  @Post('stores/:storeId/menu-categories')
  @RequirePermission('manage', 'catalog')
  public createMenuCategory(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: MenuCategoryDto,
  ) {
    return this.menus.createCategory(storeId, body);
  }

  @Patch('stores/:storeId/menu-categories/:categoryId')
  @RequirePermission('manage', 'catalog')
  public updateMenuCategory(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateMenuCategoryDto,
  ) {
    return this.menus.updateCategory(storeId, categoryId, body);
  }

  @Delete('stores/:storeId/menu-categories/:categoryId')
  @RequirePermission('manage', 'catalog')
  public deleteMenuCategory(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.menus.deleteCategory(storeId, categoryId);
  }

  @Get('stores/:storeId/menu-items')
  @RequirePermission('read', 'catalog')
  public listMenuItems(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.menus.listItems(storeId);
  }

  @Post('stores/:storeId/menu-items')
  @RequirePermission('manage', 'catalog')
  public createMenuItem(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: MenuItemDto,
  ) {
    return this.menus.createItem(storeId, body);
  }

  @Patch('stores/:storeId/menu-items/:itemId')
  @RequirePermission('manage', 'catalog')
  public updateMenuItem(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: UpdateMenuItemDto,
  ) {
    return this.menus.updateItem(storeId, itemId, body);
  }

  @Delete('stores/:storeId/menu-items/:itemId')
  @RequirePermission('manage', 'catalog')
  public deleteMenuItem(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.menus.deleteItem(storeId, itemId);
  }

  @Get('menu-items/:itemId/modifier-groups')
  @RequirePermission('read', 'catalog')
  public async listModifierGroups(
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.listModifierGroups(storeId, itemId);
  }

  @Post('menu-items/:itemId/modifier-groups')
  @RequirePermission('manage', 'catalog')
  public async createModifierGroup(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: ModifierGroupDto,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.createModifierGroup(storeId, itemId, body);
  }

  @Patch('menu-items/:itemId/modifier-groups/:groupId')
  @RequirePermission('manage', 'catalog')
  public async updateModifierGroup(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: UpdateModifierGroupDto,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.updateModifierGroup(storeId, itemId, groupId, body);
  }

  @Delete('menu-items/:itemId/modifier-groups/:groupId')
  @RequirePermission('manage', 'catalog')
  public async deleteModifierGroup(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.deleteModifierGroup(storeId, itemId, groupId);
  }

  @Get('menu-items/:itemId/modifier-groups/:groupId/options')
  @RequirePermission('read', 'catalog')
  public async listModifierOptions(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.listModifierOptions(storeId, itemId, groupId);
  }

  @Post('menu-items/:itemId/modifier-groups/:groupId/options')
  @RequirePermission('manage', 'catalog')
  public async createModifierOption(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: ModifierOptionDto,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.createModifierOption(storeId, itemId, groupId, body);
  }

  @Patch('menu-items/:itemId/modifier-groups/:groupId/options/:optionId')
  @RequirePermission('manage', 'catalog')
  public async updateModifierOption(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body() body: UpdateModifierOptionDto,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.updateModifierOption(
      storeId,
      itemId,
      groupId,
      optionId,
      body,
    );
  }

  @Delete('menu-items/:itemId/modifier-groups/:groupId/options/:optionId')
  @RequirePermission('manage', 'catalog')
  public async deleteModifierOption(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
  ) {
    const storeId = await this.menus.getItemStoreId(itemId);
    return this.menus.deleteModifierOption(
      storeId,
      itemId,
      groupId,
      optionId,
    );
  }
}
