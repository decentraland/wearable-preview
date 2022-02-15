import { AbstractMesh, Color3, Orientation, PBRMaterial, Scene, StandardMaterial, Texture } from '@babylonjs/core'
import { WearableBodyShape, WearableCategory } from '@dcl/schemas'
import { AvatarPreview } from '../avatar'
import { hexToColor } from '../color'
import { Wearable } from '../wearable'
import { Asset, loadMask, loadTexture } from './scene'
import { isCategory } from './utils'

function getCategoryLoader(scene: Scene, features: Wearable[], bodyShape: WearableBodyShape) {
  return async (category: WearableCategory) => {
    const feature = features.find(isCategory(category))
    if (feature) {
      return Promise.all([loadTexture(scene, feature, bodyShape), loadMask(scene, feature, bodyShape)]) as Promise<
        [Texture | null, Texture | null]
      >
    }
    return [null, null] as [null, null]
  }
}

export async function getFacialFeatures(scene: Scene, features: Wearable[], bodyShape: WearableBodyShape) {
  const loadCategory = getCategoryLoader(scene, features, bodyShape)
  const [eyes, eyebrows, mouth] = await Promise.all([
    loadCategory(WearableCategory.EYES),
    loadCategory(WearableCategory.EYEBROWS),
    loadCategory(WearableCategory.MOUTH),
  ])
  return { eyes, eyebrows, mouth }
}

export async function applyFacialFeatures(
  scene: Scene,
  bodyShape: Asset,
  eyes: [Texture | null, Texture | null],
  eyebrows: [Texture | null, Texture | null],
  mouth: [Texture | null, Texture | null],
  preview: AvatarPreview
) {
  for (const mesh of bodyShape.container.meshes) {
    if (mesh.name.toLowerCase().endsWith('mask_eyes')) {
      const [texture, mask] = eyes
      if (texture) {
        applyTextureAndMask(scene, 'eyes', mesh, texture, preview.eyes, mask, '#ffffff')
      }
    }
    if (mesh.name.toLowerCase().endsWith('mask_eyebrows')) {
      const [texture, mask] = eyebrows
      if (texture) {
        applyTextureAndMask(scene, 'eyebrows', mesh, texture, preview.hair, mask, preview.hair)
      }
    }
    if (mesh.name.toLowerCase().endsWith('mask_mouth')) {
      const [texture, mask] = mouth
      if (texture) {
        applyTextureAndMask(scene, 'mouth', mesh, texture, preview.skin, mask, preview.skin)
      }
    }
  }
}

function applyTextureAndMask(
  scene: Scene,
  name: string,
  mesh: AbstractMesh,
  texture: Texture,
  color: string,
  mask: Texture | null,
  maskColor: string
) {
  const newMaterial = new StandardMaterial(`${name}_standard_material`, scene)
  newMaterial.alphaMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
  newMaterial.backFaceCulling = true
  texture.hasAlpha = true
  newMaterial.sideOrientation = Orientation.CW
  newMaterial.diffuseTexture = texture
  newMaterial.diffuseColor = mask ? Color3.Black() : hexToColor(maskColor)
  if (mask) {
    newMaterial.emissiveTexture = mask
    newMaterial.emissiveColor = hexToColor(color)
  }
  mesh.material = newMaterial
}
