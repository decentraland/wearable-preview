import { describe, expect, it } from 'vitest'
import { PreviewCamera } from '@dcl/schemas'
import { inferHideControls } from './controls'

describe('inferHideControls', () => {
  it('keeps the controls for a plain mount', () => {
    expect(inferHideControls({})).toBe(false)
    expect(inferHideControls({ zoom: null, wheelZoom: null, showThumbnailBoundaries: false })).toBe(false)
    expect(inferHideControls({ camera: PreviewCamera.INTERACTIVE })).toBe(false)
  })

  it('hides them when the page frames the canvas itself', () => {
    expect(inferHideControls({ zoom: 50 })).toBe(true)
    expect(inferHideControls({ zoom: 0 })).toBe(true)
    expect(inferHideControls({ wheelZoom: 2 })).toBe(true)
    expect(inferHideControls({ showThumbnailBoundaries: true })).toBe(true)
    expect(inferHideControls({ camera: PreviewCamera.STATIC })).toBe(true)
  })
})
