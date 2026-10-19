
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
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth('bearer')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  @ApiOperation({ summary: 'List inventory batches' })
  @Get()
  getBatches() {
    return this.inventoryService.getBatches();
  }

  @ApiOperation({ summary: 'Get inventory batch by ID' })
  @Get(':id')
  getBatchById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventoryService.getBatchById(id);
  }

  @ApiOperation({ summary: 'Create inventory batch' })
  @Post()
  @Roles('ADMIN', 'PHARMACIST')
  createBatch(
    @Body() createBatchDto: CreateBatchDto,
    @Request() request: any,
  ) {
    return this.inventoryService.createBatch(
      createBatchDto,
      request.user.userId,
    );
  }

  @ApiOperation({ summary: 'Update inventory batch' })
  @Put(':id')
  @Roles('ADMIN', 'PHARMACIST')
  updateBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBatchDto: UpdateBatchDto,
    @Request() request: any,
  ) {
    return this.inventoryService.updateBatch(
      id,
      updateBatchDto,
      request.user.userId,
    );
  }

  @ApiOperation({ summary: 'Delete inventory batch' })
  @Delete(':id')
  @Roles('ADMIN', 'PHARMACIST')
  deleteBatch(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.inventoryService.deleteBatch(
      id,
      request.user.userId,
    );
  }
}
