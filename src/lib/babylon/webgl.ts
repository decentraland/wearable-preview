export type WebGLSupport = 'webgl2' | 'webgl' | 'none'

// Babylon's ThinEngine throws this exact message when it can't get a WebGL context
export const WEBGL_NOT_SUPPORTED_MESSAGE = 'WebGL not supported'

/**
 * Thrown when the browser can't provide a WebGL context. It keeps Babylon's message so embedders
 * receive the same text in the ERROR message they got before.
 */
export class WebGLNotSupportedError extends Error {
  constructor() {
    super(WEBGL_NOT_SUPPORTED_MESSAGE)
    this.name = 'WebGLNotSupportedError'
  }
}

export function isWebGLNotSupportedError(error: unknown): boolean {
  return (
    error instanceof WebGLNotSupportedError || (error instanceof Error && error.message === WEBGL_NOT_SUPPORTED_MESSAGE)
  )
}

/**
 * Checks whether the browser can create a WebGL context, using a throwaway canvas.
 * The probe context is released right away so it doesn't count against the browser's context limit.
 */
export function getWebGLSupport(): WebGLSupport {
  try {
    const canvas = document.createElement('canvas')
    for (const type of ['webgl2', 'webgl'] as const) {
      const context = canvas.getContext(type) as WebGLRenderingContext | WebGL2RenderingContext | null
      if (context) {
        context.getExtension('WEBGL_lose_context')?.loseContext()
        return type
      }
    }
  } catch {
    // some browsers throw instead of returning null when WebGL is blocked
  }
  return 'none'
}
