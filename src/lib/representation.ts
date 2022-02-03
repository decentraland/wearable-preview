import { WearableBodyShape } from '@dcl/schemas'
import { Wearable, WearableRepresentation } from './api/peer'

export function is(representation: WearableRepresentation, bodyShape: WearableBodyShape) {
  return representation.bodyShapes.includes(bodyShape)
}

export function isMale(representation: WearableRepresentation) {
  return is(representation, WearableBodyShape.MALE)
}

export function isFemale(representation: WearableRepresentation) {
  return is(representation, WearableBodyShape.FEMALE)
}

export function getRepresentation(wearable: Wearable, shape = WearableBodyShape.MALE) {
  let representation = wearable.data.representations[0]
  if (shape === WearableBodyShape.FEMALE && wearable.data.representations.some(isFemale)) {
    representation = wearable.data.representations.find(isFemale)!
  }
  return representation
}

export function getContentUrl(representation: WearableRepresentation) {
  const content = representation.contents.find((content) => content.key === representation.mainFile)
  if (!content) {
    throw new Error(`Could not find main file`)
  }
  return content.url
}

export function isTexture(representation: WearableRepresentation) {
  return representation.mainFile.endsWith('png')
}
