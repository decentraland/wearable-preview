import * as Sentry from '@sentry/browser'
import { config } from '../config'

let sentryClient: ReturnType<typeof Sentry.init>

export function initSentry() {
  const SENTRY_DSN = config.get('SENTRY_DNS')

  sentryClient = Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
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
