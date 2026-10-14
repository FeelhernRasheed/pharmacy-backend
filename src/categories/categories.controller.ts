
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@ApiBearerAuth('bearer')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  getCategories() {
    return this.categoriesService.getCategories();
  }

  @Get(':id')
  getCategoryById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.categoriesService.getCategoryById(id);
  }

  @Post()
  @Roles('ADMIN', 'PHARMACIST')
  createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @Request() request: any,
  ) {
    return this.categoriesService.createCategory(
      createCategoryDto,
      request.user.userId,
    );
  }

  @Put(':id')
  @Roles('ADMIN', 'PHARMACIST')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Request() request: any,
  ) {
    return this.categoriesService.updateCategory(
      id,
      updateCategoryDto,
      request.user.userId,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'PHARMACIST')
  deleteCategory(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.categoriesService.deleteCategory(
      id,
      request.user.userId,
    );
  }
}
