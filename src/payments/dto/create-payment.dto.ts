import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsNotEmpty,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Sale Id', example: 1 })
  @IsInt()
  @Min(1)
  sale_id: number;

  @ApiProperty({ description: 'Amount', example: 1 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Payment Method', example: 'CASH', enum: ['CASH', 'MPESA', 'CARD'] })
  @IsNotEmpty()
  @IsIn(['CASH', 'MPESA', 'CARD'])
  payment_method: string;
}