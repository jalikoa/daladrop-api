# Observability Integration Guide

## Stack overview

| Tool | Role | Port |
|---|---|---|
| **Prometheus** | Scrapes `/metrics` every 15 s, evaluates alert rules | 9090 |
| **Grafana** | Dashboards for metrics + logs | 3100 |
| **Elasticsearch** | Stores structured log documents | 9200 |
| **Logstash** | Receives JSON logs from app, enriches, indexes to ES | 5044 |
| **Kibana** | Log explorer, saved searches, Discover | 5601 |

---

## 1. Install npm packages

```bash
npm install prom-client winston winston-elasticsearch nest-winston @elastic/elasticsearch
npm install --save-dev @types/winston
```

---

## 2. Copy source files into your project

| File | Destination in your src/ |
|---|---|
| `src/common/logger/logger.service.ts` | `src/common/logger/logger.service.ts` |
| `src/common/logger/logger.module.ts` | `src/common/logger/logger.module.ts` |
| `src/modules/metrics/metrics.service.ts` | `src/modules/metrics/metrics.service.ts` |
| `src/modules/metrics/metrics.controller.ts` | `src/modules/metrics/metrics.controller.ts` |
| `src/modules/metrics/metrics.module.ts` | `src/modules/metrics/metrics.module.ts` |
| `src/modules/metrics/guards/metrics-auth.guard.ts` | `src/modules/metrics/guards/metrics-auth.guard.ts` |
| `src/modules/metrics/interceptors/http-metrics.interceptor.ts` | `src/modules/metrics/interceptors/http-metrics.interceptor.ts` |
| `src/modules/metrics/listeners/payment-metrics.listener.ts` | `src/modules/metrics/listeners/payment-metrics.listener.ts` |
| `src/modules/metrics/listeners/domain-metrics.listeners.ts` | `src/modules/metrics/listeners/domain-metrics.listeners.ts` |
| `src/modules/metrics/listeners/auth-metrics.listener.ts` | `src/modules/metrics/listeners/auth-metrics.listener.ts` |
| `src/main.ts` | Replace `src/main.ts` |
| `src/app.module.ts` | Replace `src/app.module.ts` |

---

## 3. Emit auth events from AuthService

In `src/modules/auth/services/auth.service.ts`, inject `EventEmitter2` and emit after login:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUTH_EVENTS } from '../../metrics/listeners/auth-metrics.listener';

// in constructor: private readonly eventEmitter: EventEmitter2

async login(dto: LoginDto) {
  try {
    const user = await this.validateUserData(dto.email, dto.password);
    // ... build tokens ...
    this.eventEmitter.emit(AUTH_EVENTS.LOGIN_SUCCESS, { userId: user.id, email: user.email });
    return response;
  } catch (err) {
    this.eventEmitter.emit(AUTH_EVENTS.LOGIN_FAILURE, { email: dto.email, reason: err.message });
    throw err;
  }
}
```

---

## 4. Add domain listeners to their modules

Add `PaymentMetricsListener` to `PaymentsModule.providers[]`:
```typescript
import { PaymentMetricsListener } from '../metrics/listeners/payment-metrics.listener';
providers: [...existing, PaymentMetricsListener],
```

Add `NfcMetricsListener` to `NfcModule.providers[]`, `WebhookMetricsListener` to `WebhooksModule.providers[]`,
`NotificationMetricsListener` to `NotificationsModule.providers[]`, `AuthMetricsListener` to `AuthModule.providers[]`.

---

## 5. Append env vars

Copy `.env.observability` into your `.env`:
```bash
cat .env.observability >> .env
```

Edit the values — especially:
- `METRICS_TOKEN` — any random 32+ char string
- `GRAFANA_ADMIN_PASSWORD`
- `KIBANA_ENCRYPTION_KEY` — exactly 32 chars
- Set `ELASTICSEARCH_URL=` or `LOGSTASH_HOST=` but not both (use one transport)

---

## 6. Start the stack

```bash
# From the project root (where your main docker-compose.yml lives):
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d

# Check health:
docker compose ps
curl http://localhost:9090/-/ready      # Prometheus
curl http://localhost:9200/_cluster/health  # Elasticsearch
curl http://localhost:5601/api/status   # Kibana
```

---

## 7. Import Kibana saved objects

```bash
curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" \
  -H "kbn-xsrf: true" \
  -F "file=@kibana/kibana-setup.ndjson"
```

Then visit http://localhost:5601 → Discover → select `nfc-api-logs-*`.

---

## 8. Verify metrics are being scraped

```bash
# Manually scrape (requires METRICS_TOKEN if set):
curl -H "Authorization: Bearer <METRICS_TOKEN>" http://localhost:3000/metrics

# Check Prometheus targets:
open http://localhost:9090/targets
# nfc-api target should show State=UP
```

Open Grafana at http://localhost:3100 → Dashboards → NFC Payment API.

---

## 9. Prometheus scrape config for production

If `METRICS_TOKEN` is set, configure Prometheus to send it:

```yaml
# prometheus/prometheus.yml
scrape_configs:
  - job_name: "nfc-api"
    static_configs:
      - targets: ["nfc_api:3000"]
    authorization:
      credentials: "your-32-char-metrics-scrape-token"
```

Reload Prometheus after changing: `curl -X POST http://localhost:9090/-/reload`

---

## Architecture diagram

```
NestJS App (port 3000)
  │
  ├── GET /metrics ──────────────────► Prometheus (9090)
  │       (prom-client text format)         │
  │                                         ▼
  │                                   Grafana (3100)
  │                                   dashboards + alerts
  │
  └── TCP JSON ────────────────────► Logstash (5044)
        (Winston → Logstash transport)    │
                                          ▼
                                   Elasticsearch (9200)
                                   index: nfc-api-logs-YYYY.MM.DD
                                          │
                                          ▼
                                   Kibana (5601)
                                   Discover + saved searches
```

---

## Log fields reference

Every log line emitted by `AppLogger` contains:

| Field | Example | Notes |
|---|---|---|
| `@timestamp` | `2026-03-15T12:00:00.000+03:00` | ISO8601 |
| `log.level` | `info` | normalised from Winston |
| `context` | `PaymentsService` | NestJS class name |
| `message` | `Payment completed: session=abc` | |
| `service` | `nfc-payment-api` | from APP_NAME |
| `environment` | `production` | from NODE_ENV |
| `type` | `payment_event` | custom field for filtering |
| `http.request.method` | `POST` | HTTP requests only |
| `http.response.status` | `200` | HTTP requests only |
| `url.path` | `/payments/stk` | HTTP requests only |
| `durationMs` | `142` | HTTP requests only |
| `userId` | `2` | when authenticated |
| `requestId` | `uuid` | from x-request-id header |
| `payment.sessionUuid` | `uuid` | payment events |
| `payment.merchantId` | `1` | payment events |
| `geo.country_name` | `Kenya` | GeoIP via Logstash |

---

## Metrics reference

| Metric | Type | Labels | What it tracks |
|---|---|---|---|
| `http_requests_total` | Counter | method, route, status_code | Every HTTP request |
| `http_request_duration_seconds` | Histogram | method, route, status_code | Request latency |
| `http_requests_in_flight` | Gauge | method | Active requests |
| `http_errors_total` | Counter | method, route, status_code | 4xx + 5xx |
| `payments_initiated_total` | Counter | merchant_id | STK push calls |
| `payments_completed_total` | Counter | merchant_id | Successful M-Pesa |
| `payments_failed_total` | Counter | merchant_id, reason | Failed payments |
| `payment_amount_kes_total` | Counter | merchant_id | KES volume |
| `nfc_taps_total` | Counter | merchant_id | GET /pay hits |
| `nfc_decode_errors_total` | Counter | reason | Bad tokens |
| `webhooks_received_total` | Counter | source, status | Daraja/AT callbacks |
| `notifications_queued_total` | Counter | channel | SMS/email/push |
| `auth_attempts_total` | Counter | result | Login success/fail |
| `nodejs_heap_size_used_bytes` | Gauge | — | Node.js heap |
| `nodejs_eventloop_lag_seconds` | Gauge | — | Event loop lag |