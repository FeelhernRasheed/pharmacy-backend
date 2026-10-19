import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePrescriptionDto {
  @IsInt()
  @Min(1)
  patient_id: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['PENDING'])
  status?: string;
}