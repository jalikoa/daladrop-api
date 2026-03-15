import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { JobStatus } from 'bull';
import { QueuesService } from './queues.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('queues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  /**
   * GET /queues
   * Returns waiting/active/completed/failed/delayed counts for every
   * registered queue. Quick overview of the whole job pipeline.
   */
  @Get()
  async getAll() {
    return this.queuesService.getAllStatuses();
  }

  /**
   * GET /queues/:name
   * Returns the status snapshot for a single queue by name.
   * Valid names: ledger-queue | pdf-queue | pdf-report-queue
   */
  @Get(':name')
  async getQueue(@Param('name') name: string) {
    return this.queuesService.getQueueStatus(name);
  }

  /**
   * GET /queues/:name/jobs?state=failed&start=0&end=20
   * Lists jobs in a given state for a queue (default: failed).
   * States: waiting | active | completed | failed | delayed
   */
  @Get(':name/jobs')
  async getJobs(
    @Param('name') name: string,
    @Query('state') state: JobStatus = 'failed',
    @Query('start', new DefaultValuePipe(0), ParseIntPipe) start: number,
    @Query('end', new DefaultValuePipe(20), ParseIntPipe) end: number,
  ) {
    return this.queuesService.getJobs(name, state, start, end);
  }

  /**
   * GET /queues/:name/jobs/:id
   * Fetches full detail for a single job including its current state,
   * data payload, error reason, and attempt count.
   */
  @Get(':name/jobs/:id')
  async getJob(@Param('name') name: string, @Param('id') id: string) {
    return this.queuesService.getJob(name, id);
  }

  /**
   * POST /queues/:name/jobs/:id/retry
   * Re-queues a failed job so a worker picks it up again.
   * Only works on jobs currently in the 'failed' state.
   */
  @Post(':name/jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retryJob(@Param('name') name: string, @Param('id') id: string) {
    return this.queuesService.retryJob(name, id);
  }

  /**
   * DELETE /queues/:name/jobs/:id
   * Permanently removes a job from the queue in any state.
   * Use with caution — cannot be undone.
   */
  @Delete(':name/jobs/:id')
  @HttpCode(HttpStatus.OK)
  async removeJob(@Param('name') name: string, @Param('id') id: string) {
    return this.queuesService.removeJob(name, id);
  }

  /**
   * POST /queues/:name/clean?state=completed
   * Bulk-removes all jobs in the given state from the queue.
   * Defaults to cleaning completed jobs (safe to call regularly).
   * Pass state=failed to wipe all failed jobs.
   */
  @Post(':name/clean')
  @HttpCode(HttpStatus.OK)
  async cleanQueue(
    @Param('name') name: string,
    @Query('state') state: 'completed' | 'failed' = 'completed',
  ) {
    return this.queuesService.cleanQueue(name, state);
  }

  /**
   * POST /queues/:name/pause
   * Pauses worker processing for a queue. Jobs accumulate but nothing is
   * consumed. Useful before deployments or draining a backlog.
   */
  @Post(':name/pause')
  @HttpCode(HttpStatus.OK)
  async pauseQueue(@Param('name') name: string) {
    return this.queuesService.pauseQueue(name);
  }

  /**
   * POST /queues/:name/resume
   * Resumes a paused queue. Workers start consuming jobs again immediately.
   */
  @Post(':name/resume')
  @HttpCode(HttpStatus.OK)
  async resumeQueue(@Param('name') name: string) {
    return this.queuesService.resumeQueue(name);
  }
}