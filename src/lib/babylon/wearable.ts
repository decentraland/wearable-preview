/**
 * Loads a wearable into the Scene, using a given a body shape, skin and hair color
 * @param scene
 * @param wearable
 * @param bodyShape
 * @param skin
 * @param hair
 */

import { Color3, PBRMaterial, Scene } from '@babylonjs/core'
import { WearableDefinition, WearableBodyShape } from '@dcl/schemas'
import { getRepresentation, isTexture, getContentUrl } from '../representation'
import { loadAssetContainer } from './scene'

export async function loadWearable(
  scene: Scene,
  wearable: WearableDefinition,
  bodyShape = WearableBodyShape.MALE,
  skin?: string,
  hair?: string
) {
  const representation = getRepresentation(wearable, bodyShape)
  if (isTexture(representation)) {
    throw new Error(`The wearable="${wearable.id}" is a texture`)
  }
  const url = getContentUrl(representation)
  const container = await loadAssetContainer(scene, url)

  // Clean up
  for (let material of container.materials) {
    if (material.name.toLowerCase().includes('hair')) {
      if (hair) {
        const pbr = material as PBRMaterial
        pbr.albedoColor = Color3.FromHexString(hair).toLinearSpace()
        pbr.unlit = true
        pbr.alpha = 1
      } else {
        material.alpha = 0
        scene.removeMaterial(material)
      }
    }
    if (material.name.toLowerCase().includes('skin')) {
      if (skin) {
        const pbr = material as PBRMaterial
        pbr.albedoColor = Color3.FromHexString(skin).toLinearSpace()
        pbr.unlit = true
        pbr.alpha = 1
      } else {
        material.alpha = 0
        scene.removeMaterial(material)
      }
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
