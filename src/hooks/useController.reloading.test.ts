import { createElement, MutableRefObject } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, Root } from 'react-dom/client'
import { IPreviewController, PreviewMessageType } from '@dcl/schemas'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_RELOADING_REASON, PreviewReloadingError } from '../lib/unity/scene'
import { useController } from './useController'

const { captureException, postMessage } = vi.hoisted(() => ({
  captureException: vi.fn(),
  postMessage: vi.fn(),
}))

vi.mock('../lib/sentry', () => ({ captureException }))
vi.mock('../lib/parent', () => ({ getParent: () => ({ postMessage }) }))

function requestController(id: string, method: string) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        type: PreviewMessageType.CONTROLLER_REQUEST,
        payload: { id, namespace: 'scene', method, params: [] },
      },
    }),
  )
}

function getResponse(id: string) {
  const call = postMessage.mock.calls.find(
    ([event]) => event.type === PreviewMessageType.CONTROLLER_RESPONSE && event.payload.id === id,
  )
  return call?.[0].payload
}

function mountController() {
  let controllerRef: MutableRefObject<IPreviewController | undefined> | undefined
  function Harness() {
    controllerRef = useController()
    return null
  }
  const root = createRoot(document.createElement('div'))
  // flushSync commits the render and its effects (the message listener) before returning
  flushSync(() => root.render(createElement(Harness)))
  return { root, controllerRef: controllerRef! }
}

describe('useController with the unity renderer', () => {
  let root: Root

  beforeEach(() => {
    const mounted = mountController()
    root = mounted.root
    mounted.controllerRef.current = {
      scene: {
        getScreenshot: async () => {
          throw new PreviewReloadingError()
        },
        getMetrics: async () => {
          throw new Error('Something broke')
        },
      },
    } as unknown as IPreviewController
  })

  afterEach(() => {
    root.unmount()
    vi.clearAllMocks()
  })

  describe('when a query is refused because the preview is reloading', () => {
    it('should send the failure to the parent so it can ask again', async () => {
      requestController('reloading', 'getScreenshot')
      await vi.waitFor(() =>
        expect(getResponse('reloading')).toEqual({ id: 'reloading', ok: false, error: PREVIEW_RELOADING_REASON }),
      )
    })

    it('should not report it to Sentry', async () => {
      requestController('reloading', 'getScreenshot')
      await vi.waitFor(() => expect(getResponse('reloading')).toBeDefined())
      expect(captureException).not.toHaveBeenCalled()
    })
  })

  describe('when a query fails for any other reason', () => {
    it('should send the failure to the parent and report it to Sentry', async () => {
      requestController('broken', 'getMetrics')
      await vi.waitFor(() =>
        expect(getResponse('broken')).toEqual({ id: 'broken', ok: false, error: 'Something broke' }),
      )
      expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
        phase: 'controller',
        namespace: 'scene',
        method: 'getMetrics',
      })
    })
  })
})
