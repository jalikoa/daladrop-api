import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  STORAGE_PROVIDER,
  assertSafeKey,
  type StorageProvider,
} from '../../../platform/storage';
import { LocalFilesystemStorage } from '../../../infrastructure/storage/local/local-filesystem.storage';
import { isPublicMediaKey } from '../constants/profile.constants';

@ApiTags('Media')
@Controller({ path: 'media', version: '1' })
export class MediaController {
  public constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  @Get('*path')
  public async get(
    @Param('path') pathParam: string | string[],
    @Query('expires') expiresRaw: string | undefined,
    @Query('token') token: string | undefined,
    @Query('operation') operation: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const key = this.resolveKey(pathParam, request);
    assertSafeKey(key);

    if (isPublicMediaKey(key)) {
      await this.stream(key, response);
      return;
    }

    const expires = Number(expiresRaw);
    if (
      !Number.isFinite(expires) ||
      !token ||
      (operation && operation !== 'get')
    ) {
      throw new ForbiddenException('Signed URL required');
    }
    if (this.storage instanceof LocalFilesystemStorage) {
      if (!this.storage.verifySignedUrl(key, expires, token)) {
        throw new ForbiddenException('Invalid or expired media signature');
      }
    } else {
      // Non-local providers should serve via their own signed CDN URLs.
      throw new ForbiddenException('Direct media proxy unavailable');
    }
    await this.stream(key, response);
  }

  private resolveKey(
    pathParam: string | string[],
    request: Request,
  ): string {
    const fromParam = Array.isArray(pathParam)
      ? pathParam.join('/')
      : pathParam;
    if (fromParam?.length) {
      return decodeURIComponent(fromParam.replace(/^\/+/, ''));
    }
    const prefix = '/v1/media/';
    const urlPath = request.path.startsWith(prefix)
      ? request.path.slice(prefix.length)
      : '';
    if (!urlPath) throw new BadRequestException('Missing media key');
    return decodeURIComponent(urlPath);
  }

  private async stream(key: string, response: Response): Promise<void> {
    const exists = await this.storage.exists(key);
    if (!exists) throw new NotFoundException('Object not found');
    const meta = await this.storage.stat(key);
    if (meta.contentType) {
      response.setHeader('Content-Type', meta.contentType);
    }
    response.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = await this.storage.getStream(key);
    stream.on('error', () => {
      if (!response.headersSent) {
        response.status(404).end();
      } else {
        response.destroy();
      }
    });
    stream.pipe(response);
  }
}
