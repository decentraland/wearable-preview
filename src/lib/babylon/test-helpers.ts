import { afterEach } from 'vitest'

/**
 * Sets the URL search string for the current window. Used by tests that exercise
 * URL-driven escape hatches (?toneMapping=none, ?culling=none, ?exposure=…).
 */
export function setSearch(search: string): void {
  window.history.replaceState({}, '', `/${search}`)
}

/**
 * Registers an afterEach hook that resets the URL search string so one test's
 * query params don't leak into the next.
 */
export function cleanupSearchAfterEach(): void {
  afterEach(() => setSearch(''))
}
