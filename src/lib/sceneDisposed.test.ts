import { describe, expect, it } from 'vitest'
import { isSceneDisposedError, SCENE_DISPOSED_MESSAGE, SceneDisposedError } from './sceneDisposed'

describe('SceneDisposedError', () => {
  it('should carry the message parents match on to retry', () => {
    expect(new SceneDisposedError().message).toBe('The scene was disposed, a newer render has replaced it')
    expect(SCENE_DISPOSED_MESSAGE).toBe('The scene was disposed, a newer render has replaced it')
  })

  it('should be an Error', () => {
    expect(new SceneDisposedError()).toBeInstanceOf(Error)
  })
})

describe('isSceneDisposedError', () => {
  it('should match a SceneDisposedError', () => {
    expect(isSceneDisposedError(new SceneDisposedError())).toBe(true)
  })

  it('should not match another error, even one with the same message', () => {
    expect(isSceneDisposedError(new Error(SCENE_DISPOSED_MESSAGE))).toBe(false)
    expect(isSceneDisposedError(new Error('Timeout'))).toBe(false)
  })

  it('should not match non-error values', () => {
    expect(isSceneDisposedError(undefined)).toBe(false)
    expect(isSceneDisposedError(SCENE_DISPOSED_MESSAGE)).toBe(false)
  })
})
