import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWebGLSupport, isWebGLNotSupportedError, WebGLNotSupportedError, WEBGL_NOT_SUPPORTED_MESSAGE } from './webgl'

function mockGetContext(implementation: (type: string) => unknown) {
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(implementation as unknown as HTMLCanvasElement['getContext'])
}

function createFakeContext() {
  const loseContext = vi.fn()
  const context = { getExtension: vi.fn(() => ({ loseContext })) }
  return { context, loseContext }
}

describe('getWebGLSupport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return webgl2 and release the probe context when WebGL 2 is available', () => {
    const { context, loseContext } = createFakeContext()
    mockGetContext((type) => (type === 'webgl2' ? context : null))
    expect(getWebGLSupport()).toBe('webgl2')
    expect(context.getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('should fall back to webgl when only WebGL 1 is available', () => {
    const { context } = createFakeContext()
    mockGetContext((type) => (type === 'webgl' ? context : null))
    expect(getWebGLSupport()).toBe('webgl')
  })

  it('should not fail when the lose context extension is missing', () => {
    mockGetContext((type) => (type === 'webgl2' ? { getExtension: () => null } : null))
    expect(getWebGLSupport()).toBe('webgl2')
  })

  it('should return none when no WebGL context can be created', () => {
    mockGetContext(() => null)
    expect(getWebGLSupport()).toBe('none')
  })

  it('should return none when getContext throws', () => {
    mockGetContext(() => {
      throw new Error('blocked')
    })
    expect(getWebGLSupport()).toBe('none')
  })
})

describe('isWebGLNotSupportedError', () => {
  it('should match the typed error and keep the message embedders already receive', () => {
    const error = new WebGLNotSupportedError()
    expect(isWebGLNotSupportedError(error)).toBe(true)
    expect(error.message).toBe(WEBGL_NOT_SUPPORTED_MESSAGE)
  })

  it("should match Babylon's own error", () => {
    expect(isWebGLNotSupportedError(new Error('WebGL not supported'))).toBe(true)
  })

  it('should not match other errors', () => {
    expect(isWebGLNotSupportedError(new Error('Failed to load wearable'))).toBe(false)
    expect(isWebGLNotSupportedError('WebGL not supported')).toBe(false)
    expect(isWebGLNotSupportedError(undefined)).toBe(false)
  })
})
