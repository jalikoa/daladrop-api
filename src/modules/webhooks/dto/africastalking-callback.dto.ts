import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class AfricaTalkingCallbackDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  serviceCode?: string;

  @IsEnum(['NEW', 'CONTINUE'])
  @IsOptional()
  requestType?: 'NEW' | 'CONTINUE';
}
