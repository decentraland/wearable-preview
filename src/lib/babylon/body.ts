import { WearableCategory } from '@dcl/schemas'
import { Asset } from './scene'
import { isHidden } from './utils'

export function getBodyShape(assets: Asset[]) {
  const bodyShape = assets.find((part) => part.wearable.data.category === ('body_shape' as WearableCategory))

  if (!bodyShape) {
    throw new Error(`Could not find a bodyShape when trying to hide base body parts`)
  }

  // hide base body parts if necessary
  const hasSkin = assets.some((part) => part.wearable.data.category === WearableCategory.SKIN)
  const hideUpperBody = hasSkin || assets.some(isHidden(WearableCategory.UPPER_BODY))
  const hideLowerBody = hasSkin || assets.some(isHidden(WearableCategory.LOWER_BODY))
  const hideFeet = hasSkin || assets.some(isHidden(WearableCategory.FEET))
  const hideHead = hasSkin || assets.some(isHidden('head' as WearableCategory))

  for (const mesh of bodyShape.container.meshes) {
    const name = mesh.name.toLowerCase()
    if (name.endsWith('ubody_basemesh') && hideUpperBody) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('lbody_basemesh') && hideLowerBody) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('feet_basemesh') && hideFeet) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('head') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('head_basemesh') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('mask_eyes') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('mask_eyebrows') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('mask_mouth') && hideHead) {
      mesh.setEnabled(false)
    }
  }

  return bodyShape
}
