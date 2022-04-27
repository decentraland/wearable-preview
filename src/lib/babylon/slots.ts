import { PreviewConfig, WearableCategory, WearableDefinition } from '@dcl/schemas'
import { hasRepresentation } from '../representation'
import { isEmote } from '../wearable'

const categoriesHiddenBySkin = [
  WearableCategory.HELMET,
  WearableCategory.HAIR,
  WearableCategory.FACIAL_HAIR,
  WearableCategory.MOUTH,
  WearableCategory.EYEBROWS,
  WearableCategory.EYES,
  WearableCategory.UPPER_BODY,
  WearableCategory.LOWER_BODY,
  WearableCategory.FEET,
]

export function getSlots(config: PreviewConfig) {
  const slots = new Map<WearableCategory, WearableDefinition>()

  let wearables: WearableDefinition[] = config.wearables.filter((wearable) => !isEmote(wearable)) // remove emotes if any

  // remove other wearables that hide the equipped wearable
  if (config.wearable && !isEmote(config.wearable)) {
    wearables = config.wearables.filter((wearable) => {
      if (config.wearable) {
        const { category, hides, replaces } = config.wearable.data
        if (wearable.data.category === 'skin') {
          if (categoriesHiddenBySkin.includes(category)) {
            return false
          }
          if (hides && hides.includes(WearableCategory.HEAD)) {
            return false
          }
          if (replaces && replaces.includes(WearableCategory.HEAD)) {
            return false
          }
        }
        if (wearable.data.hides && wearable.data.hides.includes(category)) {
          return false
        }
        if (wearable.data.replaces && wearable.data.replaces.includes(category)) {
          return false
        }
      }
      return true
    })
    // add the equipped wearable at the end
    wearables.push(config.wearable)
  }

  // arrange wearbles in slots
  for (const wearable of wearables) {
    const slot = wearable.data.category
    if (hasRepresentation(wearable, config.bodyShape)) {
      slots.set(slot, wearable)
    }
  }
  let hasSkin = false
  // grab only the wearables that ended up in the map, and process in reverse order (last wearables can hide/replace the first ones)
  wearables = wearables.filter((wearable) => slots.get(wearable.data.category) === wearable).reverse()
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
  // skins hide all the following slots
  if (hasSkin) {
    for (const category of categoriesHiddenBySkin) {
      slots.delete(category)
    }
  }

  return slots
}
