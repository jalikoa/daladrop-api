import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AuthTokenGuard } from '../guards/auth-token.guard';
import { CurrentAuth } from '../decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../domain/auth.contracts';
import { UpdatePasswordDto, UpdateProfileDto } from '../dto/profile.dto';
import { ProfileService } from '../use-cases/profile.service';
import {
  PROFILE_PHOTO_MAX_BYTES,
  PUBLIC_UPLOAD_MAX_BYTES,
} from '../constants/profile.constants';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'user', version: '1' })
export class UserProfileController {
  public constructor(private readonly profile: ProfileService) {}

  @Get('me')
  public me(@CurrentAuth() principal: AuthPrincipalView) {
    return this.profile.getMe(principal.id);
  }

  @Patch('update-profile')
  public updateProfile(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() input: UpdateProfileDto,
  ) {
    return this.profile.updateProfile(principal.id, input);
  }

  @Post('update-password')
  @HttpCode(200)
  public updatePassword(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() input: UpdatePasswordDto,
  ) {
    return this.profile.updatePassword(
      principal.id,
      principal.sessionId,
      input,
    );
  }

  @Post(':userId/photo')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: PROFILE_PHOTO_MAX_BYTES, files: 1 },
    }),
  )
  public uploadPhoto(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.profile.uploadPhoto(principal.id, userId, file);
  }

  @Delete('me')
  public deleteMe(@CurrentAuth() principal: AuthPrincipalView) {
    return this.profile.deleteMe(principal.id);
  }

  @Get('me/export')
  public exportMe(@CurrentAuth() principal: AuthPrincipalView) {
    return this.profile.exportMe(principal.id);
  }
}

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  public constructor(private readonly profile: ProfileService) {}

  @Post('public')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: PUBLIC_UPLOAD_MAX_BYTES, files: 1 },
    }),
  )
  public uploadPublic(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body('folder') folder: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.profile.uploadPublic(principal.id, folder, file);
  }
}
