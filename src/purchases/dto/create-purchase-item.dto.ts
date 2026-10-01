import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePurchaseItemDto {
  @IsInt()
  @Min(1)
  purchase_id: number;

  @IsInt()
  @Min(1)
  medicine_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batch_number: string;

  @IsDateString()
  expiry_date: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  buying_price: number;

  @IsNumber()
  @Min(0)
  selling_price: number;
}