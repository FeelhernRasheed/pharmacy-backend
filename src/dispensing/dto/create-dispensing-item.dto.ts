
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateDispensingItemDto {
  @ApiProperty({ example: 1, description: 'ID of the dispensing record' })
  @IsInt()
  @Min(1)
  dispensing_id: number;

  @ApiProperty({ example: 3, description: 'ID of the prescription item' })
  @IsInt()
  @Min(1)
  prescription_item_id: number;

  @ApiProperty({ example: 4, description: 'ID of the medicine batch' })
  @IsInt()
  @Min(1)
  batch_id: number;

  @ApiProperty({ example: 2, description: 'Quantity to dispense' })
  @IsInt()
  @Min(1)
  quantity: number;
}
