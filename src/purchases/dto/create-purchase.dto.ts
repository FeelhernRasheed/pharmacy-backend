import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePurchaseDto {
  @IsInt()
  @Min(1)
  supplier_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoice_number?: string;
}