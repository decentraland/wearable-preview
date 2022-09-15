import { WearableCategory, WearableDefinition } from '@dcl/schemas'
import { getWearableRepresentationOrDefault, isTexture } from '../representation'
import { Asset } from './scene'

export function isCategory(category: WearableCategory) {
  return (wearable: WearableDefinition) => wearable.data.category === category
}

export function isHidden(category: WearableCategory) {
  return (asset: Asset) => {
    return (
      asset.wearable.data.category === category ||
      (asset.wearable.data.hides || []).includes(category) ||
      (asset.wearable.data.replaces || []).includes(category)
    )
  }
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
