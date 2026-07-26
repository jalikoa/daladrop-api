import { IsUUID } from 'class-validator';

export class CreateMenuFavouriteDto {
  @IsUUID()
  menuItemId: string;
}
