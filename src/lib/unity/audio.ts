type Listener = () => void

const listeners = new Set<Listener>()
let watching = false

const notify = () => listeners.forEach((listener) => listener())

/**
 * Wraps AudioContext so contexts created afterwards report when audio that was asked for earlier can
 * finally sound: the first time the context runs (autoplay policy lifted) and every decode that finishes
 * while it runs. Call it before Unity boots: its audio context lives inside the build, out of reach.
 */
export function watchAudioReady() {
  if (watching || typeof window === 'undefined' || !window.AudioContext) return
  watching = true
  const NativeAudioContext = window.AudioContext
  window.AudioContext = class extends NativeAudioContext {
    constructor(options?: AudioContextOptions) {
      super(options)
      const onStateChange = () => {
        if (this.state !== 'running') return
        this.removeEventListener('statechange', onStateChange)
        notify()
      }
      this.addEventListener('statechange', onStateChange)
    }

    decodeAudioData(data: ArrayBuffer, onSuccess?: DecodeSuccessCallback | null, onError?: DecodeErrorCallback | null) {
      // Wrapping the callback, not chaining the promise: Unity stores the buffer in it, so it must run first.
      return super.decodeAudioData(
        data,
        (buffer) => {
          onSuccess?.(buffer)
          if (this.state === 'running') notify()
        },
        onError,
      )
    }
  }
}

export function onAudioReady(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
