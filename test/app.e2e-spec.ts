import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * E2E Test Suite
 *
 * Starts a real NestJS application with all modules loaded.
 * Requires MariaDB + Redis to be running (provided by GitHub Actions
 * service containers, or locally via `docker compose up mysql redis`).
 *
 * Run locally:
 *   docker compose up mysql redis -d
 *   npm run test:e2e
 */