import * as Sentry from '@sentry/browser'
import { config } from '../config'
import {
  browserTracingIntegration,
  dedupeIntegration,
  globalHandlersIntegration,
  httpContextIntegration,
  linkedErrorsIntegration,
} from '@sentry/browser'
import { Env } from '@dcl/ui-env'
import type { WebGPUSupport } from './webgpu'

let sentryClient: ReturnType<typeof Sentry.init>

export function initSentry() {
  const SENTRY_DSN = config.get('SENTRY_DSN')
  const ENVIRONMENT = config.get('ENVIRONMENT')
  const release = `${config.get('SENTRY_RELEASE_PREFIX', 'wearable-preview')}@${import.meta.env.VITE_REACT_APP_WEBSITE_VERSION}`
  const enabled = !config.is(Env.DEVELOPMENT)

  sentryClient = Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release,
    enabled,
    defaultIntegrations: false,
    integrations: [
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      // attaches the page URL and User-Agent, which Sentry parses into the browser, OS and device tags
      httpContextIntegration(),
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

  console.log('Sentry initialized', {
    environment: ENVIRONMENT,
    dsn: SENTRY_DSN,
    release,
  })
}

/**
 * Tag every following event with the WebGPU detection result, which decides whether the Unity renderer can be used.
 */
export function setWebGPUTags(support: Pick<WebGPUSupport, 'isSupported' | 'isAvailable'>) {
  if (!sentryClient) {
    return
  }

  Sentry.setTags({
    'webgpu.supported': support.isSupported,
    'webgpu.available': support.isAvailable,
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
