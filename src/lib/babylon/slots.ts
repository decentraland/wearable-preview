import {
  BodyPartCategory,
  HideableWearableCategory,
  PreviewConfig,
  WearableCategory,
  WearableDefinition,
} from '@dcl/schemas'
import { hasWearableRepresentation } from '../representation'
import { isWearable } from '../wearable'

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
  WearableCategory.HANDS_WEAR,
  BodyPartCategory.HANDS,
]

export function getSlots(config: PreviewConfig) {
  const slots = new Map<HideableWearableCategory, WearableDefinition>()

  let wearables: WearableDefinition[] = [...config.wearables]

  // remove other wearables that hide the equipped wearable
  if (config.item && isWearable(config.item)) {
    wearables = []
    for (const wearable of config.wearables) {
      const { category, hides, replaces } = config.item.data
      if (wearable.data.category === 'skin') {
        if (categoriesHiddenBySkin.includes(category)) {
          continue
        }
        if (hides && hides.includes(BodyPartCategory.HEAD)) {
          continue
        }
        if (replaces && replaces.includes(BodyPartCategory.HEAD)) {
          continue
        }
      }
      if (wearable.data.hides && wearable.data.hides.includes(category)) {
        continue
      }
      if (wearable.data.replaces && wearable.data.replaces.includes(category)) {
        continue
      }
      // add wearable if not hidden or replaced
      wearables.push(wearable)
    }
    // add the equipped wearable at the end
    wearables.push(config.item)
  }

  // arrange wearbles in slots
  for (const wearable of wearables) {
    const slot = wearable.data.category
    if (hasWearableRepresentation(wearable, config.bodyShape)) {
      slots.set(slot, wearable)
    }
  }
  let hasSkin = false
  // grab only the wearables that ended up in the map, and process in reverse order (last wearables can hide/replace the first ones)
  wearables = wearables.filter((wearable) => slots.get(wearable.data.category) === wearable).reverse()
  const alreadyRemoved = new Set<HideableWearableCategory>()
  for (const wearable of wearables) {
    const category = wearable.data.category
    if (alreadyRemoved.has(category)) {
      continue
    }
    const replaced = wearable.data.replaces || []
    const hidden = wearable.data.hides || []
    const toRemove = Array.from(new Set([...replaced, ...hidden])).filter(
      (category) => !config.forceRender.includes(category)
    )
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
