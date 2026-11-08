import { createElement, MutableRefObject } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, Root } from 'react-dom/client'
import { IPreviewController, PreviewMessageType } from '@dcl/schemas'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCENE_DISPOSED_MESSAGE, SceneDisposedError } from '../lib/sceneDisposed'
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

describe('useController', () => {
  let root: Root

  beforeEach(() => {
    const mounted = mountController()
    root = mounted.root
    mounted.controllerRef.current = {
      scene: {
        getMetrics: async () => {
          throw new SceneDisposedError()
        },
        getScreenshot: async () => {
          throw new Error('Something broke')
        },
      },
    } as unknown as IPreviewController
  })

  afterEach(() => {
    root.unmount()
    vi.clearAllMocks()
  })

  describe('when a call fails because a newer render disposed the scene', () => {
    it('should send the error to the parent so it can retry', async () => {
      requestController('disposed', 'getMetrics')
      await vi.waitFor(() =>
        expect(getResponse('disposed')).toEqual({ id: 'disposed', ok: false, error: SCENE_DISPOSED_MESSAGE }),
      )
    })

    it('should not report the error to Sentry', async () => {
      requestController('disposed', 'getMetrics')
      await vi.waitFor(() => expect(getResponse('disposed')).toBeDefined())
      expect(captureException).not.toHaveBeenCalled()
    })
  })

  describe('when a call fails for any other reason', () => {
    it('should send the error to the parent', async () => {
      requestController('broken', 'getScreenshot')
      await vi.waitFor(() =>
        expect(getResponse('broken')).toEqual({ id: 'broken', ok: false, error: 'Something broke' }),
      )
    })

    it('should report the error to Sentry', async () => {
      requestController('broken', 'getScreenshot')
      await vi.waitFor(() => expect(getResponse('broken')).toBeDefined())
      expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
        phase: 'controller',
        namespace: 'scene',
        method: 'getScreenshot',
      })
    })
  })
})
