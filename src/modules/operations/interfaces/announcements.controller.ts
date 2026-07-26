import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from '../dto/operations.dto';
import { AnnouncementsService } from '../use-cases/announcements.service';

@ApiTags('Announcements')
@Controller({ path: 'announcements', version: '1' })
export class AnnouncementsController {
  public constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  public listPublic() {
    return this.announcements.listPublic();
  }
}

@ApiTags('Admin Announcements')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/announcements', version: '1' })
export class AdminAnnouncementsController {
  public constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @RequirePermission('read', 'ops')
  public list() {
    return this.announcements.adminList();
  }

  @Post()
  @RequirePermission('manage', 'ops')
  public create(@Body() body: CreateAnnouncementDto) {
    return this.announcements.create(body);
  }

  @Patch(':id')
  @RequirePermission('manage', 'ops')
  public update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAnnouncementDto,
  ) {
    return this.announcements.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('manage', 'ops')
  public remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.remove(id);
  }
}
