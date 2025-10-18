import {
  ArmatureId,
  BodyPartCategory,
  EmoteClip,
  HideableWearableCategory,
  WearableCategory,
  WearableDefinition,
} from '@dcl/schemas'
import { AnimationGroup, TransformNode } from '@babylonjs/core'
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

// Extended options type to include socialEmote
export type SocialEmote =
  | (Partial<Record<ArmatureId, EmoteClip>> & {
      loop: boolean
      audio?: string
    })
  | undefined

// Helper function to determine if an animation group should be applied based on social emote config
export function shouldApplySocialEmoteAnimation(animationGroup: AnimationGroup, socialEmote: SocialEmote): boolean {
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
