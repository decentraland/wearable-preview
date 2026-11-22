import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSceneController, isPreviewReloadingError, PreviewReloadingError } from './scene'
import { UnityInstance } from './render'

type Call = { method: string; value: string }

// Unity answers a JSBridge query by posting a `unity-renderer` message back to the window.
const answer = (type: string, payload: unknown) =>
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'unity-renderer', payload: { type, payload } } }))

function fakeUnity(replies: Record<string, () => void> = {}) {
  const calls: Call[] = []
  const instance: UnityInstance = {
    SendMessage: (_object, method, value) => {
      calls.push({ method, value })
      replies[method]?.()
    },
  }
  return { instance, calls, controller: createSceneController(instance) }
}

describe('unity scene controller', () => {
  afterEach(() => vi.restoreAllMocks())

  it('asks for a capture at the requested size and resolves it as a data URL', async () => {
    const { controller, calls } = fakeUnity({ TakeScreenshot: () => answer('screenshot', 'cGlu') })
    await expect(controller.getScreenshot(1024, 768)).resolves.toBe('data:image/png;base64,cGlu')
    expect(calls).toEqual([{ method: 'TakeScreenshot', value: '1024,768' }])
  })

  it('asks for the whole canvas when the size is not in pixels', async () => {
    const { controller, calls } = fakeUnity({ TakeScreenshot: () => answer('screenshot', '') })
    await controller.getScreenshot(0, NaN)
    expect(calls).toEqual([{ method: 'TakeScreenshot', value: '' }])
  })

  it('rejects a screenshot the renderer could not take, with its reason', async () => {
    const { controller } = fakeUnity({
      TakeScreenshot: () => answer('request-failed', { request: 'screenshot', reason: 'The preview is reloading' }),
    })
    await expect(controller.getScreenshot(512, 512)).rejects.toThrow('The preview is reloading')
  })

  it('rejects a query refused mid-reload with a PreviewReloadingError', async () => {
    const { controller } = fakeUnity({
      TakeScreenshot: () => answer('request-failed', { request: 'screenshot', reason: 'The preview is reloading' }),
    })
    const error = await controller.getScreenshot(512, 512).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PreviewReloadingError)
    expect(isPreviewReloadingError(error)).toBe(true)
  })

  it('rejects a query refused for any other reason with a plain error', async () => {
    const { controller } = fakeUnity({
      TakeScreenshot: () => answer('request-failed', { request: 'screenshot', reason: 'Invalid screenshot size' }),
    })
    const error = await controller.getScreenshot(512, 512).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect(isPreviewReloadingError(error)).toBe(false)
    expect(isPreviewReloadingError(new Error('The preview is reloading'))).toBe(false)
  })

  it('resolves the metrics object as sent', async () => {
    const metrics = { triangles: 1200, materials: 2, textures: 3, meshes: 4, bodies: 4, entities: 1 }
    const { controller, calls } = fakeUnity({ GetMetrics: () => answer('metrics', metrics) })
    await expect(controller.getMetrics()).resolves.toEqual(metrics)
    expect(calls).toEqual([{ method: 'GetMetrics', value: '' }])
  })

  it('only fails on the failure of its own request', async () => {
    const { controller } = fakeUnity({
      GetMetrics: () => {
        answer('request-failed', { request: 'screenshot', reason: 'Invalid screenshot size' })
        answer('metrics', { triangles: 1 })
      },
    })
    await expect(controller.getMetrics()).resolves.toEqual({ triangles: 1 })
  })

  it('stops listening once answered', async () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    const { controller } = fakeUnity({ GetMetrics: () => answer('metrics', {}) })
    await controller.getMetrics()
    expect(removed).toHaveBeenCalledWith('message', expect.any(Function))
  })
})
