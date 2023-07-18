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
    const hidesUpperBody = asset.wearable.data.hides?.includes(WearableCategory.UPPER_BODY)
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
