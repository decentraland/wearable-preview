import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  init: vi.fn(() => ({})),
  setTags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  integration: (name: string) => vi.fn(() => ({ name })),
}))

vi.mock('@sentry/browser', () => ({
  init: sentry.init,
  setTags: sentry.setTags,
  captureException: sentry.captureException,
  captureMessage: sentry.captureMessage,
  browserTracingIntegration: sentry.integration('BrowserTracing'),
  dedupeIntegration: sentry.integration('Dedupe'),
  globalHandlersIntegration: sentry.integration('GlobalHandlers'),
  httpContextIntegration: sentry.integration('HttpContext'),
  linkedErrorsIntegration: sentry.integration('LinkedErrors'),
}))

vi.mock('../config', () => ({
  config: {
    get: (key: string, defaultValue?: string) => defaultValue ?? `test-${key}`,
    is: () => false,
  },
}))

describe('sentry', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should include the http context integration so events carry the browser, OS and device data', async () => {
    const { initSentry } = await import('./sentry')
    initSentry()
    const options = (sentry.init.mock.calls[0] as unknown as [{ integrations: { name: string }[] }])[0]
    expect(options.integrations.map((integration) => integration.name)).toContain('HttpContext')
  })

  it('should tag events with the WebGPU detection result', async () => {
    const { initSentry, setWebGPUTags } = await import('./sentry')
    initSentry()
    setWebGPUTags({ isSupported: true, isAvailable: false })
    expect(sentry.setTags).toHaveBeenCalledWith({ 'webgpu.supported': true, 'webgpu.available': false })
  })

  it('should not set tags before Sentry is initialized', async () => {
    const { setWebGPUTags } = await import('./sentry')
    setWebGPUTags({ isSupported: false, isAvailable: false })
    expect(sentry.setTags).not.toHaveBeenCalled()
  })
})
