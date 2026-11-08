/**
 * The message a scene controller call rejects with once a re-render (e.g. an options update) has disposed the
 * scene it belonged to. Parents match on this exact text to retry against the new controller (builder's
 * `isSceneDisposedError`), so it must not change.
 */
export const SCENE_DISPOSED_MESSAGE = 'The scene was disposed, a newer render has replaced it'

/**
 * Thrown on purpose by a controller whose scene a newer render has replaced. It is the expected outcome of a
 * call racing a re-render, not a fault: the caller is told (the message still reaches it through the controller
 * response) and the newer render answers its own calls.
 */
export class SceneDisposedError extends Error {
  constructor() {
    super(SCENE_DISPOSED_MESSAGE)
    this.name = 'SceneDisposedError'
  }
}

export function isSceneDisposedError(error: unknown): boolean {
  return error instanceof SceneDisposedError
}
