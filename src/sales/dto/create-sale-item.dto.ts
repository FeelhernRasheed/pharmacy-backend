import {
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateSaleItemDto {
  @IsInt()
  @Min(1)
  sale_id: number;

  @IsInt()
  @Min(1)
  batch_id: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unit_price: number;
}