import { EmoteDefinition, WearableCategory, WearableDefinition } from '@dcl/schemas'
import { isEmote } from './emote'

const MIN_ZOOM = 1
const MAX_ZOOM = 2.8
const ZOOM_RANGE = MAX_ZOOM - MIN_ZOOM

export function computeZoom(value: number) {
  const clampedValue = Math.min(Math.max(value, 0), 100)
  const percentage = clampedValue / 100
  const zoom = percentage * ZOOM_RANGE + MIN_ZOOM
  return zoom
}

export function parseZoom(rawZoom: string | null) {
  const parsedZoom = rawZoom ? parseFloat(rawZoom) : null
  return parsedZoom === null || isNaN(parsedZoom) ? null : parsedZoom
}

/**
 * Returns the right zoom for a given category
 * @param category
 * @returns
 */
export function getZoom(wearable?: WearableDefinition | EmoteDefinition | void) {
  const category = !wearable || isEmote(wearable) ? null : wearable?.data.category
  switch (category) {
    case WearableCategory.UPPER_BODY:
      return 2
    case WearableCategory.SKIN:
      return 1.75
    default:
      return 1.25
  }
}
