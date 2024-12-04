import { WearableCategory } from '@dcl/schemas'
import { Asset } from './scene'

export function getBodyShape(assets: Asset[]) {
  const bodyShape = assets?.find((part) => part.wearable.data.category === WearableCategory.BODY_SHAPE)
  if (!bodyShape) {
    return null
  }
  return bodyShape
}
