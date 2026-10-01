import {
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateSaleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  patient_id?: number;
}