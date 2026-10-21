import { PreviewCamera, PreviewOptions } from '@dcl/schemas'

type FramingOptions = Partial<Pick<PreviewOptions, 'zoom' | 'wheelZoom' | 'showThumbnailBoundaries' | 'camera'>>

/**
 * The Unity renderer draws its own controls inside the canvas (view switcher, emote and sound
 * buttons). Babylon never had any, so a page that frames the canvas for itself through Babylon's
 * options would get them drawn over its framing. A fixed zoom, wheel zoom, thumbnail boundaries or a
 * static camera all mean the page is doing the framing, so for those the controls stay hidden.
 */
export function inferHideControls(options: FramingOptions): boolean {
  return (
    (options.zoom !== null && options.zoom !== undefined) ||
    (options.wheelZoom !== null && options.wheelZoom !== undefined) ||
    options.showThumbnailBoundaries === true ||
    options.camera === PreviewCamera.STATIC
  )
}
