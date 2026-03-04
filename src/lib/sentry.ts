import * as Sentry from '@sentry/browser'
import { config } from '../config'
import {
  browserTracingIntegration,
  dedupeIntegration,
  globalHandlersIntegration,
  linkedErrorsIntegration,
} from '@sentry/browser'
import { Env } from '@dcl/ui-env'

let sentryClient: ReturnType<typeof Sentry.init>

export function initSentry() {
  const SENTRY_DSN = config.get('SENTRY_DNS')

  sentryClient = Sentry.init({
    dsn: SENTRY_DSN,
    environment: config.get('ENVIRONMENT'),
    release: `${config.get('SENTRY_RELEASE_PREFIX', 'auth')}@${import.meta.env.VITE_REACT_APP_WEBSITE_VERSION}`,
    enabled: !config.is(Env.DEVELOPMENT),
    defaultIntegrations: false,
    integrations: [
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      browserTracingIntegration({
        enableLongTask: false,
        enableLongAnimationFrame: false,
        enableInp: false,
        enableElementTiming: false,
      }),
    ],
    // Tag every event so we know it came from the iframe renderer
    initialScope: {
      tags: {
        app: 'wearable-preview',
        parentUrl: document.referrer || 'unknown',
      },
    },
  })
}

/**
 * Capture an exception in Sentry with optional contextual information.
 */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!sentryClient) {
    return
  }

  Sentry.captureException(error, context ? { extra: context } : undefined)
}

/**
 * Capture a message-level event in Sentry (for warnings / non-exception errors).
 */
export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (!sentryClient) {
    return
  }

  Sentry.captureMessage(message, { extra: context })
}
