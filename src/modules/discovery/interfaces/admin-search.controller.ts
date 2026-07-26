import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  SEARCH_ENTITY_KINDS,
  type SearchEntityKind,
} from '../constants/search-index.constants';
import { SearchIndexerService } from '../use-cases/search-indexer.service';

class ReindexSearchDto {
  @ApiPropertyOptional({
    isArray: true,
    enum: SEARCH_ENTITY_KINDS,
    description: 'Optional subset of entity kinds to reindex',
  })
  @IsOptional()
  @IsArray()
  @IsIn([...SEARCH_ENTITY_KINDS], { each: true })
  kinds?: SearchEntityKind[];
}

@ApiTags('Admin Search')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/search', version: '1' })
export class AdminSearchController {
  public constructor(private readonly indexer: SearchIndexerService) {}

  @Post('reindex')
  @RequirePermission('manage', 'search')
  public async reindex(@Body() body: ReindexSearchDto) {
    const jobId = await this.indexer.enqueue('reindex-all', {
      kinds: body.kinds,
    });
    return {
      success: true as const,
      jobId,
      queued: true as const,
      kinds: body.kinds ?? [...SEARCH_ENTITY_KINDS],
    };
  }

  @Get('status')
  @RequirePermission('manage', 'search')
  public status() {
    return this.indexer.getStatus();
  }
}
