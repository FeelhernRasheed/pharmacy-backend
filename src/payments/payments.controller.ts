import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  getPayments() {
    return this.paymentsService.getPayments();
  }

  @Get(':id')
  getPaymentById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.paymentsService.getPaymentById(id);
  }

  @Get('sale/:saleId')
  getPaymentsBySaleId(
    @Param('saleId', ParseIntPipe) saleId: number,
  ) {
    return this.paymentsService.getPaymentsBySaleId(
      saleId,
    );
  }

  @Post()
  createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(
      createPaymentDto,
    );
  }
}