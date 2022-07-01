import { BodyShape, WearableCategory, WearableDefinition } from '@dcl/schemas'

export function getWearableByCategory(wearables: WearableDefinition[], category: WearableCategory) {
  return wearables.find((wearable) => wearable.data.category === category) || null
}

export function getDefaultCategories(shape: BodyShape) {
  switch (shape) {
    case BodyShape.MALE:
      return [
        WearableCategory.EYEBROWS,
        WearableCategory.MOUTH,
        WearableCategory.EYES,
        WearableCategory.HAIR,
        WearableCategory.UPPER_BODY,
        WearableCategory.LOWER_BODY,
        WearableCategory.FEET,
      ]
    case BodyShape.FEMALE:
      return [
        WearableCategory.EYEBROWS,
        WearableCategory.MOUTH,
        WearableCategory.EYES,
        WearableCategory.HAIR,
        WearableCategory.UPPER_BODY,
        WearableCategory.LOWER_BODY,
        WearableCategory.FEET,
      ]
  }
}

export function getDefaultWearableUrn(category: WearableCategory, shape: BodyShape) {
  switch (category) {
    case WearableCategory.EYEBROWS:
      return shape === BodyShape.MALE
        ? 'urn:decentraland:off-chain:base-avatars:eyebrows_00'
        : 'urn:decentraland:off-chain:base-avatars:f_eyebrows_00'
    case WearableCategory.MOUTH:
      return shape === BodyShape.MALE
        ? 'urn:decentraland:off-chain:base-avatars:mouth_00'
        : 'urn:decentraland:off-chain:base-avatars:f_mouth_00'
    case WearableCategory.EYES:
      return shape === BodyShape.MALE
        ? 'urn:decentraland:off-chain:base-avatars:eyes_00'
        : 'urn:decentraland:off-chain:base-avatars:f_eyes_00'
    case WearableCategory.HAIR:
      return shape === BodyShape.MALE
        ? 'urn:decentraland:off-chain:base-avatars:casual_hair_01'
        : 'urn:decentraland:off-chain:base-avatars:standard_hair'
    case WearableCategory.UPPER_BODY:
      return shape === BodyShape.MALE
        ? 'urn:decentraland:off-chain:base-avatars:green_hoodie'
        : 'urn:decentraland:off-chain:base-avatars:f_sweater'
    case WearableCategory.LOWER_BODY:
      return shape === BodyShape.MALE
        ? 'urn:decentraland:off-chain:base-avatars:brown_pants'
        : 'urn:decentraland:off-chain:base-avatars:f_jeans'
    case WearableCategory.FEET:
      return shape === BodyShape.MALE
        ? 'urn:decentraland:off-chain:base-avatars:sneakers'
        : 'urn:decentraland:off-chain:base-avatars:bun_shoes'
    default:
      throw new Error(`There is no default wearable for category="${category}"`)
  }
}

export function isWearable(value: WearableDefinition | void): value is WearableDefinition {
  return !!value
}

export function getBodyShape(wearabe: WearableDefinition): BodyShape {
  const bodyShapes = [BodyShape.MALE, BodyShape.FEMALE]
  return (
    bodyShapes.find((bodyShape) =>
      wearabe.data.representations.some((representation) => representation.bodyShapes.includes(bodyShape))
    ) || bodyShapes[0]
  )
}

export function isEmote(wearable: WearableDefinition) {
  return `emoteDataV0` in wearable
}
