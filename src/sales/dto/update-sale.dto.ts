import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateSaleDto {
  @ApiProperty({ description: 'Status', example: 'COMPLETED', required: false, enum: ['COMPLETED', 'CANCELLED', 'PENDING'] })
  @IsOptional()
  @IsIn(['COMPLETED', 'CANCELLED', 'PENDING'])
  status?: string;
}