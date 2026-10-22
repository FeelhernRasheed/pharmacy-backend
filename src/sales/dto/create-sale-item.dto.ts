import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateSaleItemDto {
  @ApiProperty({ description: 'Sale Id', example: 1 })
  @IsInt()
  @Min(1)
  sale_id: number;

  @ApiProperty({ description: 'Batch Id', example: 1 })
  @IsInt()
  @Min(1)
  batch_id: number;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description:
      'Optional and ignored. The unit price is always taken from the medicine batch on the server; a value sent here is never used to calculate the subtotal.',
    example: 1,
    required: false,
    deprecated: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;
}
