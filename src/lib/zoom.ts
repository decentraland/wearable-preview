import { WearableCategory } from '@dcl/schemas'
import { Wearable } from './wearable'

export function parseZoom(rawZoom: string | null) {
  const parsedZoom = rawZoom ? parseFloat(rawZoom) : null
  const zoom = parsedZoom === null || isNaN(parsedZoom) ? null : (Math.min(Math.max(parsedZoom, 0), 100) * 1.8) / 100 + 1
  return zoom
}

/**
 * Returns the right zoom for a given category
 * @param category
 * @returns
 */
export function getZoom(wearable?: Wearable | void) {
  const category = wearable?.data.category
  switch (category) {
    case WearableCategory.UPPER_BODY:
      return 2
    case WearableCategory.SKIN:
      return 1.75
    default:
      return 1.25
  }
}
