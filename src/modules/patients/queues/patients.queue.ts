/****
 * File: patients.queue.ts
 * Module: patients
 * Purpose: Queue management and buffering logic.
 *
 ****/

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PATIENTS_QUEUE } from '../constants/patients.constants';

@Injectable()
export class PatientsQueueManager implements OnModuleInit, OnModuleDestroy {
  private flushTimer: NodeJS.Timeout | null = null;
  private buffer: any[] = [];
  private isFlushing = false;

  constructor(
    @InjectQueue(PATIENTS_QUEUE.NAME) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    this.flushTimer = setInterval(() => this.flushBuffer(), 3000);
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flushBuffer();
  }

  async add(item: any): Promise<void> {
    this.buffer.push(item);
    if (this.buffer.length >= 50) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    try {
      const itemsToFlush = [...this.buffer];
      this.buffer = [];
      await this.queue.add('batch.process', { items: itemsToFlush });
    } catch (error) {
      this.buffer = [...this.buffer, ...this.buffer]; // Retry on failure
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }
}

