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
import type { Request, Response } from 'express'; // Type-only import required for isolatedModules
import { DecodeTokenUseCase } from '../../modules/nfc/use-cases/decode-token.usecase';

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
        merchantId: token,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      // Safely extract error message to avoid unknown type error
      const message = error instanceof Error ? error.message : 'Invalid payment token';

      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: message,
      });
    }
  }
}