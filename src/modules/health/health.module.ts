import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { SystemHealthIndicator } from './indicators/system.health';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    BullModule.registerQueue({ name: 'payment-events' }),
  ],
  controllers: [HealthController],
  providers: [HealthService, DatabaseHealthIndicator, RedisHealthIndicator, SystemHealthIndicator],
  exports: [HealthService],
})
export class HealthModule {}
