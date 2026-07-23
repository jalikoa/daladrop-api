import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';

/**
 * Regression Tests
 * 
 * Tests for previously fixed bugs to ensure they don't resurface.
 * Run these tests before deploying any changes.
 * 
 * Run with: npm run test:regression
 */