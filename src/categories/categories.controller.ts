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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesService } from './categories.service';

@Controller('categories')
@UseGuards(JwtAuthGuard)
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