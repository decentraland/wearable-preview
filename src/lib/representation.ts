import { BodyShape, EmoteDefinition, RepresentationDefinition, WearableDefinition } from '@dcl/schemas'

export function is(representation: RepresentationDefinition, bodyShape: BodyShape) {
  return representation.bodyShapes.includes(bodyShape)
}

export function isMale(representation: RepresentationDefinition) {
  return is(representation, BodyShape.MALE)
}

export function isFemale(representation: RepresentationDefinition) {
  return is(representation, BodyShape.FEMALE)
}

export function getEmoteRepresentation(emote: EmoteDefinition, bodyShape = BodyShape.MALE) {
  // TODO: Remove the emoteDataV0 part after migration
  if ((emote as unknown as WearableDefinition).emoteDataV0) {
    return (emote as unknown as WearableDefinition).data.representations[0]
  }
  const representation = emote.emoteDataADR74.representations.find((representation) =>
    representation.bodyShapes.includes(bodyShape)
  )
  if (!representation) {
    throw new Error(`Could not find a representation of bodyShape=${bodyShape} for emote="${emote.id}"`)
  }
  return representation
}

export function getWearableRepresentation(wearable: WearableDefinition, bodyShape = BodyShape.MALE) {
  switch (bodyShape) {
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

export function getWearableRepresentationOrDefault(definition: WearableDefinition, shape = BodyShape.MALE) {
  if (hasWearableRepresentation(definition, shape)) {
    return getWearableRepresentation(definition, shape)
  }
  if (definition.data.representations.length > 0) {
    return definition.data.representations[0]
  }
  throw new Error(`The wearable="${definition.id}" has no representation`)
}

export function hasWearableRepresentation(definition: WearableDefinition, shape = BodyShape.MALE) {
  try {
    getWearableRepresentation(definition, shape)
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
