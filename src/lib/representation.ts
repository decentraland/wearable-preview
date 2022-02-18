import { WearableBodyShape, WearableRepresentation as WearableRepresentationBroken } from '@dcl/schemas'
import { Wearable } from './wearable'

export type WearableRepresentation = Omit<WearableRepresentationBroken, 'contents'> & { contents: { key: string; url: string }[] }

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
  switch (shape) {
    case WearableBodyShape.FEMALE: {
      if (!wearable.data.representations.some(isFemale)) {
        throw new Error(`Could not find a BaseFemale representation for wearable="${wearable.id}"`)
      }
      return wearable.data.representations.find(isFemale)!
    }
    case WearableBodyShape.MALE: {
      if (!wearable.data.representations.some(isMale)) {
        throw new Error(`Could not find a BaseMale representation for wearable="${wearable.id}"`)
      }
      return wearable.data.representations.find(isMale)!
    }
  }
}

export function getRepresentationOrDefault(wearable: Wearable, shape = WearableBodyShape.MALE) {
  if (hasRepresentation(wearable, shape)) {
    return getRepresentation(wearable, shape)
  }
  if (wearable.data.representations.length > 0) {
    return wearable.data.representations[0]
  }
  throw new Error(`The wearable="${wearable.id}" has no representation`)
}

export function hasRepresentation(wearable: Wearable, shape = WearableBodyShape.MALE) {
  try {
    getRepresentation(wearable, shape)
    return true
  } catch (error) {
    return false
  }
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
