
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  getPayments() {
    return this.paymentsService.getPayments();
  }

  @Get('status')
  getPaymentsByStatus(
    @Query('status') status: string,
  ) {
    return this.paymentsService.getPaymentsByStatus(
      status,
    );
  }

  @Get('sale/:saleId')
  getPaymentsBySaleId(
    @Param('saleId', ParseIntPipe) saleId: number,
  ) {
    return this.paymentsService.getPaymentsBySaleId(
      saleId,
    );
  }

  @Get(':id')
  getPaymentById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.paymentsService.getPaymentById(id);
  }

  @Post()
  @Roles('ADMIN', 'PHARMACIST', 'CASHIER')
  createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Req() req: any,
  ) {
    return this.paymentsService.createPayment(
      createPaymentDto,
      req.user.userId,
    );
  }
}
