import * as Sentry from '@sentry/node';
import {trace} from '@opentelemetry/api';
export function initTelemetry(){if(process.env.SENTRY_DSN)Sentry.init({dsn:process.env.SENTRY_DSN,environment:process.env.PRAEST_ENV||'development',release:process.env.PRAEST_RELEASE||undefined,tracesSampleRate:Number(process.env.SENTRY_TRACES_SAMPLE_RATE||0.1)});return trace.getTracer('praest-api')}
