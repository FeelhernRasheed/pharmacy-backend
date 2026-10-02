import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDispensingDto {
  @IsInt()
  @Min(1)
  prescription_id: number;

  @IsInt()
  @Min(1)
  dispensed_by: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status?: string;
}