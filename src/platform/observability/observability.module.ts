import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  allowInMemoryDefaults,
  type ProductionAwareOptions,
  resolveIsProduction,
} from '../architecture/production-defaults';
import { Clock } from '../../core';
import { PrometheusFormatter } from './dashboard/prometheus-formatter';
import { ErrorReporter } from './error-tracking/error-reporter.interface';
import { InMemoryErrorReporter } from './error-tracking/in-memory-error-reporter';
import { StructuredLogger } from './logging/logger.interface';
import { JsonStructuredLogger, LogLevel } from './logging/structured-logger';
import { MetricsCollector } from './metrics/metrics-collector';
import { Monitor } from './monitoring/monitor.interface';
import { MonitoringService } from './monitoring/monitoring.service';
import { Profiler as ProfilerContract } from './profiling/profiler.interface';
import { Profiler } from './profiling/profiler';
import { InMemoryTracer } from './tracing/in-memory-tracer';
import { Tracer } from './tracing/tracer.interface';

export const OBSERVABILITY_LOGGER = Symbol('OBSERVABILITY_LOGGER');
export const OBSERVABILITY_MONITOR = Symbol('OBSERVABILITY_MONITOR');
export const OBSERVABILITY_TRACER = Symbol('OBSERVABILITY_TRACER');
export const OBSERVABILITY_METRICS = Symbol('OBSERVABILITY_METRICS');
export const OBSERVABILITY_ERROR_REPORTER = Symbol(
  'OBSERVABILITY_ERROR_REPORTER',
);
export const OBSERVABILITY_PROFILER = Symbol('OBSERVABILITY_PROFILER');

export interface ObservabilityModuleOptions extends ProductionAwareOptions {
  readonly logger?: StructuredLogger;
  readonly monitor?: Monitor;
  readonly tracer?: Tracer;
  readonly metrics?: MetricsCollector;
  readonly errorReporter?: ErrorReporter;
  readonly profiler?: ProfilerContract;
  readonly clock?: Clock;
  readonly minimumLogLevel?: LogLevel;
}

@Module({})
export class ObservabilityModule {
  public static register(
    options: ObservabilityModuleOptions = {},
  ): DynamicModule {
    const isProduction = resolveIsProduction(options);
    const allowInMemory = allowInMemoryDefaults(options);
    const clock: Clock = options.clock ?? {
      now: (): Date => new Date(),
      timestamp: (): number => Date.now(),
    };

    const monitor =
      options.monitor ?? (allowInMemory ? new MonitoringService() : undefined);
    const tracer =
      options.tracer ?? (allowInMemory ? new InMemoryTracer(clock) : undefined);
    const metrics =
      options.metrics ?? (allowInMemory ? new MetricsCollector() : undefined);
    const errorReporter =
      options.errorReporter ??
      (allowInMemory ? new InMemoryErrorReporter() : undefined);

    if (isProduction && !options.allowInMemory) {
      if (!options.monitor || !options.tracer || !options.errorReporter) {
        throw new Error(
          'ObservabilityModule: external monitor, tracer, and errorReporter are required in production (or set allowInMemory: true)',
        );
      }
    }
    if (!monitor || !tracer || !metrics || !errorReporter) {
      throw new Error(
        'ObservabilityModule: monitor, tracer, metrics, and errorReporter are required in production (or set allowInMemory: true)',
      );
    }

    const providers: Provider[] = [
      {
        provide: OBSERVABILITY_LOGGER,
        useValue:
          options.logger ??
          new JsonStructuredLogger(
            undefined,
            undefined,
            options.minimumLogLevel,
          ),
      },
      { provide: OBSERVABILITY_MONITOR, useValue: monitor },
      { provide: OBSERVABILITY_TRACER, useValue: tracer },
      { provide: OBSERVABILITY_METRICS, useValue: metrics },
      { provide: OBSERVABILITY_ERROR_REPORTER, useValue: errorReporter },
      {
        provide: OBSERVABILITY_PROFILER,
        useValue: options.profiler ?? new Profiler(),
      },
      PrometheusFormatter,
    ];
    return {
      module: ObservabilityModule,
      providers,
      exports: [
        OBSERVABILITY_LOGGER,
        OBSERVABILITY_MONITOR,
        OBSERVABILITY_TRACER,
        OBSERVABILITY_METRICS,
        OBSERVABILITY_ERROR_REPORTER,
        OBSERVABILITY_PROFILER,
        PrometheusFormatter,
      ],
    };
  }
}
