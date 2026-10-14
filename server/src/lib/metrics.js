/**
 * SyncExc Server — Prometheus metrics
 *
 * Registers HTTP and business metrics once at startup. Exposes them on
 * a configurable path. Every metric accessor is idempotent.
 */

import client from 'prom-client';
import config from '../config.js';

let registry;
let httpRequestsTotal;
let httpRequestDuration;
let httpRequestsInFlight;
let businessCounters;

export function initMetrics() {
  if (registry) return getMetrics();

  registry = new client.Registry();
  registry.setDefaultLabels({ service: 'syncexc-server', env: config.env });

  client.collectDefaultMetrics({ register: registry, prefix: 'syncexc_' });

  httpRequestsTotal = new client.Counter({
    name: 'syncexc_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });

  httpRequestDuration = new client.Histogram({
    name: 'syncexc_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  httpRequestsInFlight = new client.Gauge({
    name: 'syncexc_http_requests_in_flight',
    help: 'HTTP requests currently being processed',
    registers: [registry],
  });

  const counters = {
    usersRegistered: new client.Counter({
      name: 'syncexc_users_registered_total',
      help: 'Total users registered',
      registers: [registry],
    }),
    logins: new client.Counter({
      name: 'syncexc_logins_total',
      help: 'Total login attempts',
      labelNames: ['result'],
      registers: [registry],
    }),
    ordersSubmitted: new client.Counter({
      name: 'syncexc_orders_submitted_total',
      help: 'Total orders submitted',
      labelNames: ['exchange', 'market_type', 'status'],
      registers: [registry],
    }),
    syncOperations: new client.Counter({
      name: 'syncexc_sync_operations_total',
      help: 'Total sync operations',
      labelNames: ['status'],
      registers: [registry],
    }),
    riskDecisions: new client.Counter({
      name: 'syncexc_risk_decisions_total',
      help: 'Total risk decisions',
      labelNames: ['outcome'],
      registers: [registry],
    }),
    signalsIngested: new client.Counter({
      name: 'syncexc_signals_ingested_total',
      help: 'Total signals ingested',
      labelNames: ['source_type', 'status'],
      registers: [registry],
    }),
    notificationsDelivered: new client.Counter({
      name: 'syncexc_notifications_delivered_total',
      help: 'Total notifications delivered',
      labelNames: ['channel', 'state'],
      registers: [registry],
    }),
    jobsProcessed: new client.Counter({
      name: 'syncexc_jobs_processed_total',
      help: 'Total jobs processed',
      labelNames: ['type', 'status'],
      registers: [registry],
    }),
    jobDuration: new client.Histogram({
      name: 'syncexc_job_duration_seconds',
      help: 'Job processing duration',
      labelNames: ['type'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300],
      registers: [registry],
    }),
    webhookDeliveries: new client.Counter({
      name: 'syncexc_webhook_deliveries_total',
      help: 'Total webhook deliveries',
      labelNames: ['state'],
      registers: [registry],
    }),
  };
  businessCounters = counters;

  return getMetrics();
}

export function getMetrics() {
  return {
    registry,
    http: {
      requestsTotal: httpRequestsTotal,
      requestDuration: httpRequestDuration,
      requestsInFlight: httpRequestsInFlight,
    },
    business: businessCounters,
    contentType: registry.contentType,
    metrics: () => registry.metrics(),
    reset: () => registry.resetMetrics(),
  };
}

export default initMetrics;