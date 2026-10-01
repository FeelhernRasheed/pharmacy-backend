import {
  IsIn,
  IsInt,
  IsNumber,
  IsNotEmpty,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @Min(1)
  sale_id: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  @IsIn(['CASH', 'MPESA', 'CARD'])
  payment_method: string;
}