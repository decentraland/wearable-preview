import { captureException } from '../sentry'
import type { UnityInstance } from './render'

/**
 * A trap raised by the renderer's WebAssembly (`memory access out of bounds`, `unreachable`, …). After
 * one, the module's memory is in an unknown state: every later call into it traps again, starting with
 * the allocation of the message string itself.
 */
export function isWasmTrap(error: unknown): boolean {
  if (typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.RuntimeError) return true
  // Errors thrown across realms fail `instanceof`; the name is still the trap's.
  return error instanceof Error && error.name === 'RuntimeError'
}

/**
 * Makes `instance` stop at its first WebAssembly trap. The trap is reported once with the message that hit
 * it and handed to `onCrash`. Every later `SendMessage` is dropped, so the page stops driving a renderer
 * that can no longer run, instead of reporting each message as a crash of its own. Any other error
 * propagates as before.
 */
export function stopOnCrash(instance: UnityInstance, onCrash?: (error: unknown) => void): UnityInstance {
  const send = instance.SendMessage.bind(instance) as (objectName: string, methodName: string, value?: string) => void
  let crashed = false

  instance.SendMessage = ((objectName: string, methodName: string, value?: string) => {
    if (crashed) return
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
    }
  }) as UnityInstance['SendMessage']

  return instance
}
