import { AnimationGroup, ArcRotateCamera, Scene, TransformNode } from '@babylonjs/core'
import { AvatarCamera, AvatarPreview } from '../avatar'
import { startAutoRotateBehavior } from './camera'
import { Asset, loadAssetContainer } from './scene'

export async function playEmote(scene: Scene, assets: Asset[], preview: AvatarPreview) {
  let baseUrl = process.env.PUBLIC_URL || ''
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/'
  }
  const path = `./emotes/${preview.emote}.glb`
  const url = baseUrl.startsWith('http') ? new URL(path, baseUrl).href : path
  const container = await loadAssetContainer(scene, url)
  if (container.animationGroups.length === 0) {
    throw new Error(`No animation groups found for emote=${preview.emote}`)
  }
  const emoteAnimationGroup = new AnimationGroup('emote', scene)
  for (const asset of assets) {
    const nodes = asset.container.transformNodes.reduce((map, node) => {
      const list = map.get(node.id) || []
      list.push(node)
      return map.set(node.id, list)
    }, new Map<string, TransformNode[]>())
    for (const targetedAnimation of container.animationGroups[0].targetedAnimations) {
      const animation = targetedAnimation.animation
      const target = targetedAnimation.target as TransformNode
      const newTargets = nodes.get(target.id)
      if (newTargets && newTargets.length > 0) {
        for (const newTarget of newTargets) {
          emoteAnimationGroup.addTargetedAnimation(animation, newTarget)
        }
      }
    }
  }
  emoteAnimationGroup.play()

  // start camera rotation after animation ends
  function onAnimationEnd() {
    if (preview.camera !== AvatarCamera.STATIC) {
      const camera = scene.cameras[0] as ArcRotateCamera
      startAutoRotateBehavior(camera, preview)
    }
  }
  emoteAnimationGroup.onAnimationEndObservable.addOnce(onAnimationEnd)
}
