/**
 * Loads a wearable into the Scene, using a given a body shape, skin and hair color
 * @param scene
 * @param wearable
 * @param bodyShape
 * @param skin
 * @param hair
 */

import { Color3, PBRMaterial, Scene } from '@babylonjs/core'
import { CellMaterial } from '@babylonjs/materials'
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

  var i = 0
  // Clean up
  for (const originalMaterial of container.materials) {
    originalMaterial.name = originalMaterial.name + '-' + i++

    const newMaterial = new CellMaterial(originalMaterial.name + '_cell', scene)

    newMaterial.diffuseColor = (originalMaterial as PBRMaterial).albedoColor
    newMaterial.diffuseTexture = (originalMaterial as PBRMaterial).albedoTexture;
    newMaterial.transparencyMode = originalMaterial.transparencyMode
    newMaterial.computeHighLevel = true;

    for (const mesh of originalMaterial.getBindedMeshes()) {
      mesh.material = newMaterial
    }

    scene.removeMaterial(originalMaterial)

    if (newMaterial.name.toLowerCase().includes('hair')) {
      if (hair) {
        newMaterial.diffuseColor = Color3.FromHexString(hair).toLinearSpace()
        // pbr.unlit = true
        newMaterial.alpha = 1
      } else {
        newMaterial.alpha = 0
        scene.removeMaterial(newMaterial)
      }
    }
    if (newMaterial.name.toLowerCase().includes('skin')) {
      if (skin) {
        newMaterial.diffuseColor = Color3.FromHexString(skin).toLinearSpace()
        // newMaterial.unlit = true
        newMaterial.alpha = 1
      } else {
        newMaterial.alpha = 0
        scene.removeMaterial(newMaterial)
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
