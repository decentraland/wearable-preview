import { WearableCategory } from '@dcl/schemas'
import { AvatarPreview } from '../avatar'
import { hasRepresentation } from '../representation'
import { isEmote, Wearable } from '../wearable'

const categoriesHiddenBySkin = [
  WearableCategory.HAIR,
  WearableCategory.FACIAL_HAIR,
  WearableCategory.MOUTH,
  WearableCategory.EYEBROWS,
  WearableCategory.EYES,
  WearableCategory.UPPER_BODY,
  WearableCategory.LOWER_BODY,
  WearableCategory.FEET,
]

export function getSlots(preview: AvatarPreview) {
  const slots = new Map<WearableCategory, Wearable>()

  let wearables: Wearable[] = preview.wearables.filter((wearable) => !isEmote(wearable)) // remove emotes if any

  // remove other wearables that hide the equipped wearable
  if (preview.wearable && !isEmote(preview.wearable)) {
    wearables = preview.wearables.filter((wearable) => {
      if (preview.wearable) {
        const { category, hides, replaces } = preview.wearable.data
        if (wearable.data.category === 'skin') {
          if (categoriesHiddenBySkin.includes(category)) {
            return false
          }
          if (hides && hides.includes('head' as WearableCategory)) {
            return false
          }
          if (replaces && replaces.includes('head' as WearableCategory)) {
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
    wearables.push(preview.wearable)
  }

  // arrange wearbles in slots
  for (const wearable of wearables) {
    const slot = wearable.data.category
    if (hasRepresentation(wearable, preview.bodyShape)) {
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
