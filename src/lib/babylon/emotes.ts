import { AnimationGroup, Scene, TransformNode } from '@babylonjs/core'
import { AvatarEmote } from '../avatar'
import { Asset, loadAssetContainer } from './scene'

export async function playEmote(scene: Scene, assets: Asset[], emote: AvatarEmote) {
  let baseUrl = process.env.PUBLIC_URL || ''
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/'
  }
  const path = `./emotes/${emote}.glb`
  const url = baseUrl.startsWith('http') ? new URL(path, baseUrl).href : path
  const container = await loadAssetContainer(scene, url)
  if (container.animationGroups.length === 0) {
    throw new Error(`No animation groups found for emote=${emote}`)
  }
  const emoteAnimationGroup = new AnimationGroup('emote', scene)
  for (const asset of assets) {
    const nodes = asset.container.transformNodes.reduce((map, node) => map.set(node.id, node), new Map<string, TransformNode>())
    for (const targetedAnimation of container.animationGroups[0].targetedAnimations) {
      const animation = targetedAnimation.animation
      const target = targetedAnimation.target as TransformNode
      const newTarget = nodes.get(target.id)
      if (newTarget) {
        emoteAnimationGroup.addTargetedAnimation(animation, newTarget)
      }
    }
  }
  emoteAnimationGroup.play()
}
