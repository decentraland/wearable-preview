import { captureException } from '../sentry'
import type { UnityInstance } from './render'

/**
 * Thrown for every message sent to a renderer that has crashed, the one that hit the crash included. The
 * crash itself is reported once by `stopOnCrash`, so callers answer with this error (a parent's controller
 * request gets `ok: false`) without reporting it again.
 */
export class UnityCrashedError extends Error {
  constructor(method: string, options?: { cause?: unknown }) {
    super(`The preview renderer crashed and can't handle ${method}`)
    this.name = 'UnityCrashedError'
    if (options && 'cause' in options) (this as { cause?: unknown }).cause = options.cause
  }
}

export function isUnityCrashedError(error: unknown): error is UnityCrashedError {
  return error instanceof UnityCrashedError
}

/**
 * A trap raised by the renderer's WebAssembly (`memory access out of bounds`, `unreachable`, …). After
 * one, the module's memory is in an unknown state: every later call into it traps again, starting with
 * the allocation of the message string itself.
 */
export function isWasmTrap(error: unknown): boolean {
  return typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.RuntimeError
}

/**
 * Makes `instance` stop at its first WebAssembly trap. The trap is reported once, with the message that
 * hit it, and handed to `onCrash`. From then on, every `SendMessage` (that one included) throws
 * `UnityCrashedError` without calling into the renderer, so the page stops driving a renderer that can no
 * longer run and awaited queries still settle. Any other error propagates as before.
 */
export function stopOnCrash(instance: UnityInstance, onCrash?: (error: unknown) => void): void {
  // Typed with an optional value: `sendUnityMessage` makes parameterless calls on the untyped instance.
  const send = instance.SendMessage.bind(instance) as (objectName: string, methodName: string, value?: string) => void
  let crashed = false

  instance.SendMessage = (objectName: string, methodName: string, value?: string) => {
    if (crashed) throw new UnityCrashedError(methodName)
    try {
      // The renderer tells a parameterless call from an empty string, so the arity is kept.
      if (value === undefined) send(objectName, methodName)
      else send(objectName, methodName, value)
    } catch (error) {
      if (!isWasmTrap(error)) throw error
      crashed = true
      console.error(`Unity renderer crashed handling ${methodName}:`, error)
      captureException(error, { phase: 'unityCrashed', method: methodName })
      onCrash?.(error)
      throw new UnityCrashedError(methodName, { cause: error })
    }
  }
}

/** For fire-and-forget calls: a crash is already reported and surfaced, anything else is rethrown. */
export function ignoreUnityCrash(error: unknown): void {
  if (!isUnityCrashedError(error)) throw error
}
