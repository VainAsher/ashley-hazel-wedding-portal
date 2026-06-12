# TASK-015 Performance Monitoring Design

## Context

TASK-015 is the final Week 2 monitoring task for the wedding portal backend. The
current backend is a FastAPI application with Pydantic settings, SQLAlchemy
engine/sessionmaker database access, structured logging with secret masking, and
optional Sentry error tracking. Sentry tracing is intentionally disabled, so
performance visibility should be provided by lightweight in-process metrics and
logs.

## Goal

Expose Prometheus-compatible performance metrics for HTTP requests and database
queries, and log slow HTTP requests and database queries through the existing
structured logging system.

## Requirements

- Add a Prometheus scrape endpoint at `GET /metrics`.
- Allow metrics to be disabled with `METRICS_ENABLED=false`.
- Track request count, request duration, and active requests.
- Track database query count and database query duration.
- Log slow HTTP requests when duration exceeds `SLOW_REQUEST_THRESHOLD_MS`.
- Log slow database queries when duration exceeds `SLOW_QUERY_THRESHOLD_MS`.
- Keep metric labels low-cardinality by using FastAPI route templates instead
  of raw request paths.
- Avoid logging PII, request bodies, query parameters, SQL parameters, or full
  SQL statements.
- Document how to inspect metrics and configure thresholds.
- Test configuration, metrics output, request instrumentation, disabled metrics,
  and slow-operation logging.

## Recommended Approach

Use `prometheus-client` inside the existing FastAPI process. Add a focused
`app/metrics.py` module that owns metric definitions, request middleware,
database event listeners, and the Prometheus response helper. Wire the module
from `app/main.py` and `app/db/database.py`.

This is the smallest production-useful approach for this codebase. It avoids a
new SaaS dependency, preserves the Sentry decision from TASK-014, and leaves
Prometheus/Grafana deployment as an external operations choice.

## Alternatives Considered

### Sentry Performance Tracing

Sentry could collect request and database timing with little application code.
This was rejected for TASK-015 because TASK-014 deliberately configured
`traces_sample_rate=0.0`, and relying on Sentry would make performance
monitoring depend on an external account.

### Separate Metrics Server Or Full Prometheus Stack

Starting a second metrics server or shipping a Prometheus/Grafana stack would be
more operationally complete, but it is too much infrastructure for the current
task. Exposing `/metrics` is enough for local validation and future scraping.

## Architecture

### `app.config.Settings`

Add:

```python
metrics_enabled: bool = True
slow_request_threshold_ms: float = Field(default=500.0, ge=0.0)
slow_query_threshold_ms: float = Field(default=500.0, ge=0.0)
```

These settings should be included in `.env.example`, `.env.staging`, and
`.env.production`. Production may use a stricter slow request threshold, but the
default code path should be safe and predictable in all environments.

### `app.metrics`

Responsibilities:

- Define Prometheus collectors:
  - `http_requests_total{method, endpoint, status}`
  - `http_request_duration_seconds{method, endpoint, status}`
  - `http_active_requests`
  - `db_queries_total{operation, status}`
  - `db_query_duration_seconds{operation}`
- Provide `metrics_middleware(settings)` for FastAPI request instrumentation.
- Provide `metrics_response(settings)` for `GET /metrics`.
- Provide SQLAlchemy event handlers for query timing.
- Provide helper functions for route-template extraction, SQL operation
  extraction, and SQL statement summarization.

HTTP endpoint labels should use the matched route path from
`request.scope["route"].path` when available. If no route is available, fall
back to `request.url.path`. This keeps labels stable for routes such as
`/api/guests/{guest_id}`.

SQL labels should use only the operation, such as `SELECT`, `INSERT`, `UPDATE`,
`DELETE`, or `UNKNOWN`. Table labels are intentionally excluded because reliable
table extraction without a SQL parser is fragile and can create label churn.

### `app.main`

Wire the middleware after settings and logging are initialized:

```python
from app.metrics import metrics_middleware, metrics_response

app.middleware("http")(metrics_middleware(settings))

@app.get("/metrics", include_in_schema=False)
async def metrics():
    return metrics_response(settings)
```

When `metrics_enabled` is false, `metrics_response` should return `404` so the
endpoint is not exposed. The middleware may no-op when metrics are disabled.

### `app.db.database`

Import `app.metrics` so SQLAlchemy event listeners are registered for the
engine. The handlers should read the current settings at runtime so tests can
construct explicit settings and so threshold changes apply after process
restart.

## Slow Logging

Use `app.logging.get_logger(__name__)` in `app.metrics`. Slow logs should be
structured events:

- `slow_http_request`
- `slow_db_query`

HTTP slow logs include:

- `method`
- `endpoint`
- `status`
- `duration_ms`
- `threshold_ms`

Database slow logs include:

- `operation`
- `duration_ms`
- `threshold_ms`
- `statement_summary`

`statement_summary` should be a short sanitized summary that contains the SQL
operation and a bounded prefix with whitespace normalized. It must not include
SQL parameters or database connection details.

Do not log request bodies, query strings, headers, guest emails, phone numbers,
names, SQL parameters, or full SQL statements.

## Error Handling

Metrics collection must not change application behavior. Request instrumentation
must decrement the active request gauge in a `finally` block. If a request
raises, record status `500` and re-raise the original exception.

Database instrumentation must tolerate unusual statements or missing timing
state. If SQL operation extraction fails, record `UNKNOWN`. Instrumentation
errors should not break queries.

## Documentation

Create `docs/ci/PERFORMANCE_MONITORING.md` covering:

- Configuration variables.
- Local `curl http://localhost:3001/metrics` usage.
- Key metrics and what they mean.
- Slow request and slow query log events.
- Example Prometheus scrape configuration.
- Example alert expressions for high latency, high error rate, and slow
  database queries.

Update `docs/ci/MONITORING.md` to link TASK-015 performance monitoring from the
Sentry monitoring document.

## Testing

Use test-first implementation. Required tests:

- Settings load `metrics_enabled`, `slow_request_threshold_ms`, and
  `slow_query_threshold_ms`.
- Invalid negative thresholds fail validation.
- `/metrics` returns Prometheus text format when enabled.
- `/metrics` returns `404` when disabled.
- A request increments `http_requests_total` and observes request duration using
  a route-template endpoint label.
- Slow request logging emits `slow_http_request` with safe fields.
- SQL operation extraction handles common SQL operations.
- Slow query logging emits `slow_db_query` without SQL parameters.

The request tests should avoid requiring a live database where possible by using
`/health` or `/`. Database instrumentation tests can exercise helper functions
directly and use monkeypatching for slow-log behavior rather than depending on a
real PostgreSQL connection.

## Acceptance Criteria

- `prometheus-client` is added to backend requirements.
- `GET /metrics` exposes Prometheus text when enabled.
- Metrics can be disabled by configuration.
- Request metrics are recorded with stable endpoint labels.
- Database query metrics are recorded with operation labels.
- Slow HTTP requests and slow database queries are logged with sanitized
  structured fields.
- Documentation explains local viewing, scraping, and alert examples.
- Focused backend tests pass.
