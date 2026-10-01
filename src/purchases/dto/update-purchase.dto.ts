import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoice_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}