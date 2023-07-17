import { BodyPartCategory, HideableWearableCategory, WearableCategory, WearableDefinition } from '@dcl/schemas'
import { getWearableRepresentationOrDefault, isTexture } from '../representation'
import { Asset } from './scene'

export function isCategory(category: WearableCategory) {
  return (wearable: WearableDefinition) => wearable.data.category === category
}

export function isHidden(category: HideableWearableCategory) {
  return (asset: Asset) => {
    return (
      asset.wearable.data.category === category ||
      (asset.wearable.data.hides || []).includes(category) ||
      (asset.wearable.data.replaces || []).includes(category)
    )
  }
}

export function isHandsBodyPartHidden(assets: Asset[]) {
  return assets.some((asset) => {
    const isUpperBody = asset.wearable.data.category === WearableCategory.UPPER_BODY
    const hidesUpperBody = asset.wearable.data.hides.includes(WearableCategory.UPPER_BODY)
    const removesDefaultHiding = asset.wearable.data.removesDefaultHiding?.includes(BodyPartCategory.HANDS)
    return (isUpperBody || hidesUpperBody) && !removesDefaultHiding
  })
}

export function isSuccesful(result: void | Asset): result is Asset {
  return !!result
}

export function isModel(wearable: WearableDefinition): boolean {
  const representation = getWearableRepresentationOrDefault(wearable)
  return !isTexture(representation)
}

export function isFacialFeature(wearable: WearableDefinition): boolean {
  return !isModel(wearable)
}

export function areWearablesCompatible(wearable1: WearableDefinition, wearable2: WearableDefinition) {
  if (
    wearable1.data.category === WearableCategory.HANDS_WEAR ||
    wearable2.data.category === WearableCategory.HANDS_WEAR
  ) {
    const handsWear = wearable1.data.category === WearableCategory.HANDS_WEAR ? wearable1 : wearable2
    const wearable = wearable1.data.category === WearableCategory.HANDS_WEAR ? wearable2 : wearable1

    const isHandsWearCompatible = !handsWear.data.hides.includes(BodyPartCategory.HANDS)
    const isOrHidesUpperBody =
      wearable.data.category === WearableCategory.UPPER_BODY ||
      wearable.data.hides.includes(WearableCategory.UPPER_BODY)
    const removesDefaultHiding = wearable.data.removesDefaultHiding?.includes(WearableCategory.HANDS_WEAR)
  
    return isHandsWearCompatible || removesDefaultHiding || !isOrHidesUpperBody
  }

  return true
}

export function getAdditionHiddenProperties(
  wearable: WearableDefinition,
  slots: Map<HideableWearableCategory, WearableDefinition>
) {
  if (wearable.data.category === WearableCategory.HANDS_WEAR) {
    return Array.from(slots.values())
      .filter((w) => !areWearablesCompatible(wearable, w))
      .map((w) => w.data.category)
  }

  const handsWearable = slots.get(WearableCategory.HANDS_WEAR)
  if (handsWearable && !areWearablesCompatible(wearable, handsWearable)) {
    return [WearableCategory.HANDS_WEAR]
  }

  return []
}
