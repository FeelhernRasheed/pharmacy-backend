import { IsIn, IsOptional } from 'class-validator';

export class UpdateSaleDto {
  @IsOptional()
  @IsIn(['COMPLETED', 'CANCELLED', 'PENDING'])
  status?: string;
}