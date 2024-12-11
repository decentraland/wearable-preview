import { BodyShape, EmoteDefinition, WearableRepresentationDefinition, WearableDefinition } from '@dcl/schemas'

export function is(representation: WearableRepresentationDefinition, bodyShape: BodyShape) {
  return representation.bodyShapes.includes(bodyShape)
}

export function isMale(representation: WearableRepresentationDefinition) {
  return is(representation, BodyShape.MALE)
}

export function isFemale(representation: WearableRepresentationDefinition) {
  return is(representation, BodyShape.FEMALE)
}

export function getEmoteRepresentation(emote: EmoteDefinition, bodyShape = BodyShape.MALE) {
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
      const female = wearable.data.representations.find(isFemale)
      if (!female) {
        throw new Error(`Could not find a BaseFemale representation for wearable="${wearable.id}"`)
      }
      return female
    }
    case BodyShape.MALE: {
      const male = wearable.data.representations.find(isMale)!
      if (!male) {
        throw new Error(`Could not find a BaseMale representation for wearable="${wearable.id}"`)
      }
      return male
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

export function getContentUrl(representation: WearableRepresentationDefinition) {
  const content = representation.contents.find((content) => content.key === representation.mainFile)
  if (!content) {
    throw new Error(`Could not find main file`)
  }
  return content.url
}

export function isTexture(representation: WearableRepresentationDefinition) {
  return representation.mainFile.endsWith('png')
}

export function isTextureFile(key: string) {
  return key?.endsWith('png') && !key?.includes('Avatar_MaleSkinBase')
}

export function isTextureSkinFile(key: string) {
  return key?.endsWith('png')
}
