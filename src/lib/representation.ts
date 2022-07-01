import { BodyShape, RepresentationDefinition, WearableDefinition } from '@dcl/schemas'

export function is(representation: RepresentationDefinition, bodyShape: BodyShape) {
  return representation.bodyShapes.includes(bodyShape)
}

export function isMale(representation: RepresentationDefinition) {
  return is(representation, BodyShape.MALE)
}

export function isFemale(representation: RepresentationDefinition) {
  return is(representation, BodyShape.FEMALE)
}

export function getRepresentation(wearable: WearableDefinition, shape = BodyShape.MALE) {
  switch (shape) {
    case BodyShape.FEMALE: {
      if (!wearable.data.representations.some(isFemale)) {
        throw new Error(`Could not find a BaseFemale representation for wearable="${wearable.id}"`)
      }
      return wearable.data.representations.find(isFemale)!
    }
    case BodyShape.MALE: {
      if (!wearable.data.representations.some(isMale)) {
        throw new Error(`Could not find a BaseMale representation for wearable="${wearable.id}"`)
      }
      return wearable.data.representations.find(isMale)!
    }
  }
}

export function getRepresentationOrDefault(wearable: WearableDefinition, shape = BodyShape.MALE) {
  if (hasRepresentation(wearable, shape)) {
    return getRepresentation(wearable, shape)
  }
  if (wearable.data.representations.length > 0) {
    return wearable.data.representations[0]
  }
  throw new Error(`The wearable="${wearable.id}" has no representation`)
}

export function hasRepresentation(wearable: WearableDefinition, shape = BodyShape.MALE) {
  try {
    getRepresentation(wearable, shape)
    return true
  } catch (error) {
    return false
  }
}

export function getContentUrl(representation: RepresentationDefinition) {
  const content = representation.contents.find((content) => content.key === representation.mainFile)
  if (!content) {
    throw new Error(`Could not find main file`)
  }
  return content.url
}

export function isTexture(representation: RepresentationDefinition) {
  return representation.mainFile.endsWith('png')
}
