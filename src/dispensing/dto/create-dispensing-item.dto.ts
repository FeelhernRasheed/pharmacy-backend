import {
  IsInt,
  Min,
} from 'class-validator';

export class CreateDispensingItemDto {
  @IsInt()
  @Min(1)
  dispensing_id: number;

  @IsInt()
  @Min(1)
  prescription_item_id: number;

  @IsInt()
  @Min(1)
  batch_id: number;

  @IsInt()
  @Min(1)
  quantity: number;
}