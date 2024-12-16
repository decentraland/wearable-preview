/**
 * Loads a wearable into the Scene, using a given a body shape, skin and hair color
 * @param scene
 * @param wearable
 * @param bodyShape
 * @param skin
 * @param hair
 */

import { Scene } from '@babylonjs/core'
import { WearableDefinition, BodyShape } from '@dcl/schemas'
import { getWearableRepresentation, isTexture, getContentUrl } from '../representation'
import { loadAssetContainer } from './scene'

export async function loadWearable(
  scene: Scene,
  wearable: WearableDefinition,
  bodyShape = BodyShape.MALE,
  skin?: string,
  hair?: string
) {
  const representation = getWearableRepresentation(wearable, bodyShape)
  if (isTexture(representation)) {
    throw new Error(`The wearable="${wearable.id}" is a texture`)
  }
  const url = getContentUrl(representation)
  const container = await loadAssetContainer(scene, url)

  // Remove colliders
  for (const mesh of container.meshes) {
    if (mesh.name.toLowerCase().includes('collider')) {
      mesh.isVisible = false
      scene.removeMesh(mesh)
    }
  }

  // Stop any animations
  for (const animationGroup of container.animationGroups) {
    animationGroup.stop()
    animationGroup.reset()
    animationGroup.dispose()
  }

  return { container, wearable }
}
