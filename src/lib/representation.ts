import { WearableBodyShape } from '@dcl/schemas'
import { WearableRepresentation } from './api/peer'

export function is(representation: WearableRepresentation, bodyShape: WearableBodyShape) {
  return representation.bodyShapes.includes(bodyShape)
}

export function isMale(representation: WearableRepresentation) {
  return is(representation, WearableBodyShape.MALE)
}

export function isFemale(representation: WearableRepresentation) {
  return is(representation, WearableBodyShape.FEMALE)
}
