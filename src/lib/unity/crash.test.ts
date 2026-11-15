import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureException } from '../sentry'
import { sendUnityMessage, UnityMethod } from './messages'
import type { UnityInstance } from './render'
import { isWasmTrap, stopOnCrash } from './crash'

vi.mock('../sentry', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

type Sent = [string] | [string, string]

function fakeRenderer(failWith?: () => unknown) {
  const sent: Sent[] = []
  const instance: UnityInstance = {
    SendMessage: (_target: string, method: string, value?: string) => {
      if (failWith) throw failWith()
      sent.push(value === undefined ? [method] : [method, value])
    },
  }
  return { instance, sent }
}

const outOfBounds = () => new WebAssembly.RuntimeError('memory access out of bounds')

describe('stopOnCrash', () => {
  let onCrash: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    onCrash = vi.fn()
  })

  describe('when the renderer is healthy', () => {
    it('should deliver messages as they are, keeping parameterless calls parameterless', () => {
      const { instance, sent } = fakeRenderer()
      stopOnCrash(instance, onCrash)

      instance.SendMessage('JSBridge', 'SetEmote', 'idle')
      sendUnityMessage(instance, UnityMethod.RELOAD)

      expect(sent).toEqual([['SetEmote', 'idle'], ['Reload']])
      expect(onCrash).not.toHaveBeenCalled()
    })
  })

  describe('when the renderer traps', () => {
    let error: unknown
    let failingSends: number

    beforeEach(() => {
      failingSends = 0
      const { instance } = fakeRenderer(() => {
        failingSends++
        error = outOfBounds()
        return error
      })
      stopOnCrash(instance, onCrash)

      // What the preview sends when the parent pushes an update (WEARABLE-PREVIEW-9P sent ten of these).
      sendUnityMessage(instance, UnityMethod.SET_EMOTE, 'idle')
      sendUnityMessage(instance, UnityMethod.CLEAR_BASE64)
      sendUnityMessage(instance, UnityMethod.RELOAD)
      instance.SendMessage('JSBridge', UnityMethod.SET_SPRING_BONES_PARAMS, '{}')
    })

    it('should report the crash once, with the message that hit it', () => {
      expect(captureException).toHaveBeenCalledTimes(1)
      expect(captureException).toHaveBeenCalledWith(error, { phase: 'unityCrashed', method: 'SetEmote' })
    })

    it('should hand the crash to the preview once', () => {
      expect(onCrash).toHaveBeenCalledTimes(1)
      expect(onCrash).toHaveBeenCalledWith(error)
    })

    it('should stop calling into the crashed renderer', () => {
      expect(failingSends).toBe(1)
    })
  })

  describe('when a message fails with an error that is not a trap', () => {
    it('should let the error through and keep delivering later messages', () => {
      let fail = true
      const sent: string[] = []
      const instance: UnityInstance = {
        SendMessage: (_target: string, method: string) => {
          if (fail) throw new TypeError('JSBridge is not ready')
          sent.push(method)
        },
      }
      stopOnCrash(instance, onCrash)

      expect(() => instance.SendMessage('JSBridge', 'Reload', '')).toThrow(TypeError)
      fail = false
      instance.SendMessage('JSBridge', 'Reload', '')

      expect(sent).toEqual(['Reload'])
      expect(onCrash).not.toHaveBeenCalled()
    })
  })
})

describe('isWasmTrap', () => {
  it('should recognise a WebAssembly runtime error, also from another realm', () => {
    const foreign = Object.assign(new Error('unreachable'), { name: 'RuntimeError' })

    expect(isWasmTrap(outOfBounds())).toBe(true)
    expect(isWasmTrap(foreign)).toBe(true)
  })

  it('should not treat other errors as a trap', () => {
    expect(isWasmTrap(new TypeError('x is undefined'))).toBe(false)
    expect(isWasmTrap('memory access out of bounds')).toBe(false)
  })
})
