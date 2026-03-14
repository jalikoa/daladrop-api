import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DecodeTokenUseCase } from '../../modules/nfc/use-cases/decode-token.usecase';
import { DecodeTokenDto } from '../../modules/nfc/dto/decode-token.dto';

@Controller()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PublicController {
  constructor(private readonly decodeTokenUseCase: DecodeTokenUseCase) {}

  @Get('pay')
  @HttpCode(HttpStatus.OK)
  async handleNfcPaymentRequest(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.decodeTokenUseCase.execute({
        encryptedToken: token,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: error.message || 'Invalid payment token',
      });
    }
  }
}
