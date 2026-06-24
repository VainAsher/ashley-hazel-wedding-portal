# Performance Monitoring

TASK-015 adds Prometheus-compatible backend performance metrics and slow
operation logging for the FastAPI API.

## Configuration

Set these variables in `production/backend/.env`:

```bash
METRICS_ENABLED=true
SLOW_REQUEST_THRESHOLD_MS=500
SLOW_QUERY_THRESHOLD_MS=500
```

`METRICS_ENABLED=false` disables the `/metrics` endpoint and skips in-process
metric collection.

`SLOW_REQUEST_THRESHOLD_MS` controls when the backend logs a
`slow_http_request` warning.

`SLOW_QUERY_THRESHOLD_MS` controls when the backend logs a `slow_db_query`
warning.

Recommended defaults:

- Development: `500` ms requests, `500` ms queries.
- Staging: `500` ms requests, `500` ms queries.
- Production: `200` ms requests, `500` ms queries.

## Metrics Endpoint

Start the backend, then inspect metrics:

```bash
curl http://localhost:3001/metrics
```

The endpoint returns Prometheus text format. It is excluded from the OpenAPI
schema.

`/metrics` is **unauthenticated**, so it is meant to be scraped from inside the
network only. In production the backend publishes no host ports
(`docker-compose.prod.yml` closes them), making `/metrics` reachable only on the
internal `wedding` Docker network. In staging the backend is published on
`:3001` (hence the `localhost:3001` examples here); keep that host internal.
This metrics path is independent of Sentry — Sentry stays optional and disabled
unless `SENTRY_DSN` is set (see `docs/ci/MONITORING.md`).

## Key Metrics

- `http_requests_total`: request count by method, endpoint route template, and
  status.
- `http_request_duration_seconds`: request latency histogram by method,
  endpoint route template, and status.
- `http_active_requests`: current in-flight request count.
- `db_queries_total`: database query count by SQL operation and status.
- `db_query_duration_seconds`: database query latency histogram by SQL
  operation.

Endpoint labels use route templates such as `/api/guests/{guest_id}` instead of
raw paths. This keeps metric cardinality bounded.

Database labels use SQL operations such as `SELECT`, `INSERT`, `UPDATE`,
`DELETE`, and `UNKNOWN`. SQL parameters are never logged or added to labels.

## Slow Operation Logs

Slow request logs use the structured event name `slow_http_request` with:

- `method`
- `endpoint`
- `status`
- `duration_ms`
- `threshold_ms`

Slow database query logs use the structured event name `slow_db_query` with:

- `operation`
- `status`
- `duration_ms`
- `threshold_ms`
- `statement_summary`

`statement_summary` is sanitized and bounded. It does not include SQL
parameters, request bodies, headers, guest contact details, or database
credentials.

## Prometheus Scrape Example

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: wedding-api
    metrics_path: /metrics
    static_configs:
      - targets:
          - localhost:3001
```

## Alert Examples

High p95 response time:

```promql
histogram_quantile(
  0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
) > 1
```

High 5xx rate:

```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) > 0.05
```

Slow p95 database queries:

```promql
histogram_quantile(
  0.95,
  sum(rate(db_query_duration_seconds_bucket[5m])) by (le, operation)
) > 0.5
```

## Verification

Run:

```bash
cd production/backend
python scripts/validate_config.py
python -m pytest tests/test_metrics.py -q
curl http://localhost:3001/metrics
```

Confirm the metrics output includes:

- `http_requests_total`
- `http_request_duration_seconds`
- `http_active_requests`
- `db_queries_total`
- `db_query_duration_seconds`
