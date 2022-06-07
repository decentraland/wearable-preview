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
import './toon'

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
  for (const originalMaterial of container.materials) {
    if (originalMaterial instanceof PBRMaterial) {
      const newMaterial = originalMaterial as PBRMaterial

      // remove metallic effect
      newMaterial.specularIntensity = 0
      if (newMaterial.metallic) {
        newMaterial.metallic = 0
        newMaterial.metallicF0Factor = 0
      }

      if (newMaterial.name.toLowerCase().includes('hair')) {
        if (hair) {
          newMaterial.albedoColor = Color3.FromHexString(hair).toLinearSpace()
          newMaterial.specularIntensity = 0
          newMaterial.alpha = 1
        } else {
          newMaterial.alpha = 0
          scene.removeMaterial(newMaterial)
        }
      }
      if (newMaterial.name.toLowerCase().includes('skin')) {
        if (skin) {
          newMaterial.albedoColor = Color3.FromHexString(skin).toLinearSpace()
          newMaterial.specularIntensity = 0
          newMaterial.alpha = 1
        } else {
          newMaterial.alpha = 0
          scene.removeMaterial(newMaterial)
        }
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
