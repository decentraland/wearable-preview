import { WearableCategory } from '@dcl/schemas'
import { getRepresentationOrDefault, isTexture } from '../representation'
import { Wearable } from '../wearable'
import { Asset } from './scene'

export function isCategory(category: WearableCategory) {
  return (wearable: Wearable) => wearable.data.category === category
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

export function isModel(wearable: Wearable): boolean {
  const representation = getRepresentationOrDefault(wearable)
  return !isTexture(representation)
}

export function isFacialFeature(wearable: Wearable): boolean {
  return !isModel(wearable)
}
