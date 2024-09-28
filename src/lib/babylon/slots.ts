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

// based on https://adr.decentraland.org/adr/ADR-239
const categoriesPriority = [
  WearableCategory.SKIN,
  WearableCategory.UPPER_BODY,
  WearableCategory.HANDS_WEAR,
  WearableCategory.LOWER_BODY,
  WearableCategory.FEET,
  WearableCategory.HELMET,
  WearableCategory.HAT,
  WearableCategory.TOP_HEAD,
  WearableCategory.MASK,
  WearableCategory.EYEWEAR,
  WearableCategory.EARRING,
  WearableCategory.TIARA,
  WearableCategory.HAIR,
  WearableCategory.EYEBROWS,
  WearableCategory.EYES,
  WearableCategory.MOUTH,
  WearableCategory.FACIAL_HAIR,
  WearableCategory.BODY_SHAPE
]

function getHides(wearable: WearableDefinition) {    
  const category = wearable.data.category 
  const replaced = wearable.data.replaces || []
  const hidden = wearable.data.hides || []
  if (category === WearableCategory.SKIN) {
    hidden.push(...categoriesHiddenBySkin)
  }
  return Array.from(new Set([...replaced, ...hidden])).filter(
    ($) => $ !== category
  )
}

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
  const forceRender = config.forceRender || []
  const alreadyRemoved = new Set<HideableWearableCategory>()
  for (const category of categoriesPriority) {
    const wearable = slots.get(category)
    if (!wearable) {
      continue
    }

    if (alreadyRemoved.has(category)) {
      continue
    }
    
    for (const slot of getHides(wearable)) {
      alreadyRemoved.add(slot)
    }
  }

  const toHide = Array.from(alreadyRemoved).filter(category => !forceRender.includes(category))
  for (const category of toHide) {
    slots.delete(category)
  }

  return slots
}
