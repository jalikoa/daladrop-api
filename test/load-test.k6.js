/**
 * k6 Load Testing Script
 * 
 * Run with: k6 run load-test.k6.js
 * 
 * Install k6: https://k6.io/docs/getting-started/installation/
 * 
 * This script tests the API under load.
 * Configure environment variables:
 *   - BASE_URL: API base URL (default: http://localhost:3000)
 *   - AUTH_TOKEN: JWT token for authenticated requests
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users (peak load)
    { duration: '30s', target: 50 },  // Ramp down to 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete below 500ms
    errors: ['rate<0.01'],            // Error rate should be less than 1%
    payment_response_time: ['p(95)<1000'], // Payment endpoints < 1s
    auth_response_time: ['p(95)<500'],     // Auth endpoints < 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Test data
const testCredentials = {
  email: 'admin@nfcapi.com',
  password: 'AdminPass123!',
};

