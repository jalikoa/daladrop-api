# Enterprise API Scaffold (NestJS)

A production-grade, project-agnostic starting point for backend services.
Clone it, rename it, and build your domain modules on top — the CI/CD,
containerization, and observability layers are already done.

## What's included

| Layer | What you get |
|---|---|
| **CI** (`.github/workflows/ci.yml`) | Lint, unit + E2E tests (PostgreSQL/Redis service containers), coverage, JUnit artifacts, build check, dependency audit, secret scanning |
| **Security** (`codeql.yml`, `dependabot.yml`, PR dependency review) | SAST, automated dependency updates, vulnerable-dependency gating |
| **CD** (`cd.yml`) | GHCR image build with layer caching, SHA + semver tags, environment-gated SSH deploy, post-deploy health checks |
| **Releases** (`release.yml`) | Automated semantic versioning + changelog via release-please (Conventional Commits) |
| **Docker** (`Dockerfile`, `docker-compose.yml`) | Multi-stage build, non-root user, dumb-init PID 1, healthchecks, PostgreSQL + Redis stack |
| **Observability** (`docker-compose.observability.yml`) | Prometheus + Alertmanager + Grafana (auto-provisioned dashboards), Elasticsearch + Logstash + Kibana + Filebeat log pipeline |

## Quick start

```bash
# 1. Configure
cp .env.example .env          # edit secrets and connection settings

# 2. Install & run (local development)
npm ci
npm run start:dev

# 3. Or run the full containerized stack
docker compose up -d

# 4. Optionally add the observability stack
docker compose --env-file .env.observability \
  -f docker-compose.yml -f docker-compose.observability.yml up -d
```

| Service | URL (local) |
|---|---|
| API | http://localhost:3000 |
| Grafana | http://localhost:3100 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| Kibana | http://localhost:5601 |

## Testing

```bash
npm run test          # unit tests
npm run test:cov      # unit tests + coverage
npm run test:e2e      # end-to-end tests (requires DB + Redis)
bash scripts/test-local.sh --e2e   # everything, with CI-equivalent settings
```

See [TESTING.md](./TESTING.md) for the full test-suite documentation.

## Observability

Metrics are scraped from `GET /metrics` (prom-client); structured JSON logs
flow through Filebeat/Logstash into Elasticsearch with ECS field mapping,
sensitive-field redaction, and GeoIP enrichment. Dashboards and alert rules
are version-controlled and auto-provisioned.

See [LOG_OBSERVABILITY.md](./LOG_OBSERVABILITY.md) for the full guide.

## Conventions

- **Commits / PR titles** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, ...) — enforced in CI and used to drive releases.
- **Branches**: `main` (production), `develop`, `feature/**`, `fix/**`, `hotfix/**`.
- **Dashboards** live in `grafana/dashboards/`; **alert rules** in
  `prometheus/alerts.yml`; **alert routing** in `alertmanager/alertmanager.yml`.

## Adapting the scaffold

1. Rename the package in `package.json` and set `APP_NAME` in `.env`.
2. Add your domain modules under `src/modules/`.
3. Rename the generic `business_*` metrics and their alert rules/dashboard
   panels to your domain's terminology.
4. Configure the deploy secrets listed at the top of `.github/workflows/cd.yml`
   and create a `production` GitHub Environment with required reviewers.
