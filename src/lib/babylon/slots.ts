import { WearableCategory } from '@dcl/schemas'
import { AvatarPreview } from '../avatar'
import { hasRepresentation } from '../representation'
import { Wearable } from '../wearable'

export function getSlots(preview: AvatarPreview) {
  const slots = new Map<WearableCategory, Wearable>()

  for (const wearable of preview.wearables) {
    const slot = wearable.data.category
    if (hasRepresentation(wearable, preview.bodyShape)) {
      slots.set(slot, wearable)
    }
  }
  let hasSkin = false
  // grab only the wearables that ended up in the map, and process in reverse order (last wearables can hide/replace the first ones)
  const wearables = preview.wearables.filter((wearable) => slots.get(wearable.data.category) === wearable).reverse()
  const alreadyRemoved = new Set<string>()
  for (const wearable of wearables) {
    const category = wearable.data.category
    if (alreadyRemoved.has(category)) {
      continue
    }
    const replaced = wearable.data.replaces || []
    const hidden = wearable.data.hides || []
    const toRemove = Array.from(new Set([...replaced, ...hidden]))
    for (const slot of toRemove) {
      if (slot !== category) {
        slots.delete(slot)
        alreadyRemoved.add(slot)
      }
    }
    if (wearable.data.category === WearableCategory.SKIN) {
      hasSkin = true
    }
  }
  if (hasSkin) {
    slots.delete(WearableCategory.HAIR)
    slots.delete(WearableCategory.FACIAL_HAIR)
    slots.delete(WearableCategory.MOUTH)
    slots.delete(WearableCategory.EYEBROWS)
    slots.delete(WearableCategory.EYES)
    slots.delete(WearableCategory.UPPER_BODY)
    slots.delete(WearableCategory.LOWER_BODY)
    slots.delete(WearableCategory.FEET)
  }

  return slots
}
