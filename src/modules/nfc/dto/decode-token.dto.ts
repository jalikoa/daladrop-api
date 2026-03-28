import { IsString, IsNotEmpty } from 'class-validator';

export class DecodeTokenDto {
  @IsString()
  @IsNotEmpty()
  muid: string;
}
