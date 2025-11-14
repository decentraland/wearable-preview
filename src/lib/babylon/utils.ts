import { BodyPartCategory, HideableWearableCategory, WearableCategory, WearableDefinition } from '@dcl/schemas'
import { SocialEmoteAnimation } from '@dcl/schemas/dist/dapps/preview/social-emote-animation'
import { AnimationGroup, TransformNode, Color3, PBRMaterial, StandardMaterial } from '@babylonjs/core'
import { getWearableRepresentationOrDefault, isTexture } from '../representation'
import { Asset } from './scene'

export function isCategory(category: WearableCategory) {
  return (wearable: WearableDefinition) => wearable.data.category === category
}

export function isHidden(category: HideableWearableCategory) {
  return (asset: Asset) => {
    return (
      asset.wearable.data.category === category ||
      (asset.wearable.data.hides || []).includes(category) ||
      (asset.wearable.data.replaces || []).includes(category)
    )
  }
}

export function isHandsBodyPartHidden(assets: Asset[]) {
  return assets.some((asset) => {
    const isUpperBody = asset.wearable.data.category === WearableCategory.UPPER_BODY
    const hidesUpperBody = asset.wearable.data.hides?.includes(WearableCategory.UPPER_BODY)
    const removesDefaultHiding = asset.wearable.data.removesDefaultHiding?.includes(BodyPartCategory.HANDS)
    return (isUpperBody || hidesUpperBody) && !removesDefaultHiding
  })
}

export function isSuccesful(result: void | Asset): result is Asset {
  return !!result
}

export function isModel(wearable: WearableDefinition): boolean {
  const representation = getWearableRepresentationOrDefault(wearable)
  return !isTexture(representation)
}

export function isFacialFeature(wearable: WearableDefinition): boolean {
  return !isModel(wearable)
}

// Helper function to determine if an animation group should be applied based on social emote config
export function shouldApplySocialEmoteAnimation(
  animationGroup: AnimationGroup,
  socialEmote: SocialEmoteAnimation,
): boolean {
  const groupName = animationGroup.name.toLowerCase()

  // Check if this is a prop animation
  const isPropAnimation = groupName.includes('prop') || groupName.includes('armature_prop')

  // Check if this is an "other" avatar animation
  const isOtherAnimation = groupName.includes('avatarother') || groupName.includes('armature_other')

  // Check if this is a main avatar animation
  const isMainAvatarAnimation =
    groupName.includes('avatar') || groupName.includes('armature') || (!isPropAnimation && !isOtherAnimation)

  // Apply filtering based on what's specified in socialEmote
  if (socialEmote?.Armature_Prop?.animation.toLowerCase() === groupName && isPropAnimation) {
    return true
  }

  if (socialEmote?.Armature_Other?.animation.toLowerCase() === groupName && isOtherAnimation) {
    return true
  }

  if (socialEmote?.Armature?.animation.toLowerCase() === groupName && isMainAvatarAnimation) {
    return true
  }

  // If no social emote is specified, apply all animations
  if (!socialEmote?.Armature && !socialEmote?.Armature_Other && !socialEmote?.Armature_Prop) {
    return true
  }

  // Default: don't apply if not explicitly specified
  return false
}

// Helper: pair children by index to build a twin map (original -> clone)
function getContainerRoots(container: { transformNodes: TransformNode[]; meshes: TransformNode[] }) {
  const all = [...container.transformNodes, ...container.meshes] as TransformNode[]
  const set = new Set(all)
  // a root is any node whose parent isn't in this container
  return all.filter((n) => !n.parent || !set.has(n.parent as TransformNode))
}

/** DFS pair children by index to build original -> clone mapping. */
export function buildTwinMapFromContainer(
  container: { transformNodes: TransformNode[]; meshes: TransformNode[] },
  cloneRoots: TransformNode[],
): Map<TransformNode, TransformNode> {
  const map = new Map<TransformNode, TransformNode>()
  const origRoots = getContainerRoots(container)

  const pairRec = (a: TransformNode, b: TransformNode) => {
    map.set(a, b)
    const ac = a.getChildren() as TransformNode[]
    const bc = b.getChildren() as TransformNode[]
    const n = Math.min(ac.length, bc.length)
    for (let i = 0; i < n; i++) pairRec(ac[i], bc[i])
  }

  const n = Math.min(origRoots.length, cloneRoots.length)
  for (let i = 0; i < n; i++) pairRec(origRoots[i], cloneRoots[i])

  return map
}

/**
 * Processes and modifies materials for the "other" avatar in social emotes.
 * - Clones all materials to avoid affecting the original avatar
 * - Applies solid color to skin materials (removes textures)
 * - Hides non-skin materials
 */
export const processOtherAvatarMaterials = (cloneRoots: TransformNode[], skinColor: Color3): void => {
  for (const cloneRoot of cloneRoots) {
    cloneRoot.getChildMeshes().forEach((child) => {
      if (!child.material) {
        return
      }

      // Clone the material so changes don't affect the original avatar
      const clonedMaterial = child.material.clone(child.material.name + '_Other')
      if (!clonedMaterial) {
        return
      }

      const isSkinMaterial = clonedMaterial.name.toLowerCase().includes('skin')

      if (isSkinMaterial && clonedMaterial instanceof PBRMaterial) {
        // Clone and remove textures to apply solid color to skin
        const texture = clonedMaterial.albedoTexture
        if (texture) {
          texture.dispose()
        }
        clonedMaterial.albedoTexture = undefined as any

        const bumpTexture = clonedMaterial.bumpTexture
        if (bumpTexture) {
          bumpTexture.dispose()
        }
        clonedMaterial.bumpTexture = undefined as any

        const metallicTexture = clonedMaterial.metallicTexture
        if (metallicTexture) {
          metallicTexture.dispose()
        }
        clonedMaterial.metallicTexture = undefined as any

        // Apply the solid color
        clonedMaterial.albedoColor = skinColor
        clonedMaterial.specularIntensity = 0
        child.material = clonedMaterial
      } else if (isSkinMaterial && clonedMaterial instanceof StandardMaterial) {
        // Clone and remove textures to apply solid color to skin
        const diffuseTexture = clonedMaterial.diffuseTexture
        if (diffuseTexture) {
          diffuseTexture.dispose()
        }
        clonedMaterial.diffuseTexture = undefined as any

        const bumpTexture = clonedMaterial.bumpTexture
        if (bumpTexture) {
          bumpTexture.dispose()
        }
        clonedMaterial.bumpTexture = undefined as any

        const specularTexture = clonedMaterial.specularTexture
        if (specularTexture) {
          specularTexture.dispose()
        }
        clonedMaterial.specularTexture = undefined as any

        // Apply the solid color
        clonedMaterial.diffuseColor = skinColor
        clonedMaterial.specularColor = Color3.Black()
        child.material = clonedMaterial
      } else {
        // Not a skin material - hide it
        clonedMaterial.dispose()
        child.visibility = 0
      }
    })
  }
}
