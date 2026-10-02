import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePrescriptionDto {
  @IsInt()
  @Min(1)
  patient_id: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  prescribed_by?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status?: string;
}