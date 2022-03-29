import { AnimationGroup, ArcRotateCamera, AssetContainer, Scene, TransformNode } from '@babylonjs/core'
import { AvatarCamera, AvatarEmote, AvatarPreview } from '../avatar'
import { getRepresentation } from '../representation'
import { isEmote, Wearable } from '../wearable'
import { startAutoRotateBehavior } from './camera'
import { Asset, loadAssetContainer } from './scene'

const loopedEmotes = [AvatarEmote.IDLE, AvatarEmote.MONEY, AvatarEmote.CLAP]

function isLooped(emote: AvatarEmote) {
  return loopedEmotes.includes(emote)
}

// cache emotes, this is so wecan play on loop without downloading the GLB again
const cache: Record<string, AssetContainer> = {}

export function buildEmoteUrl(emote: AvatarEmote) {
  let baseUrl = process.env.PUBLIC_URL || ''
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/'
  }
  const path = `./emotes/${emote}.glb`
  const url = baseUrl.startsWith('http') ? new URL(path, baseUrl).href : path
  return url
}

export async function loadEmoteFromUrl(scene: Scene, url: string) {
  let container = cache[url]
  if (!container) {
    container = await loadAssetContainer(scene, url)
    if (container.animationGroups.length === 0) {
      throw new Error(`No animation groups found for emote with url=${url}`)
    }
    cache[url] = container
  }
  return container
}

export async function loadEmoteFromWearable(scene: Scene, wearable: Wearable, preview: AvatarPreview) {
  const representation = getRepresentation(wearable, preview.bodyShape)
  const content = representation.contents.find((content) => content.key === representation.mainFile)
  if (!content) {
    throw new Error(`Could not find a valid content in representation for wearable=${wearable.id} and bodyShape=${preview.bodyShape}`)
  }
  return loadEmoteFromUrl(scene, content.url)
}

export async function playEmote(scene: Scene, assets: Asset[], preview: AvatarPreview) {
  // load asset container for emote
  let container: AssetContainer | undefined
  let loop = isLooped(preview.emote)
  if (preview.wearable && isEmote(preview.wearable)) {
    try {
      container = await loadEmoteFromWearable(scene, preview.wearable, preview)
      loop = !!preview.wearable.emoteDataV0?.loop
    } catch (error) {
      console.warn(`Could not load emote=${preview.wearable.id}`)
    }
  }
  if (!container) {
    const emoteUrl = buildEmoteUrl(preview.emote)
    container = await loadEmoteFromUrl(scene, emoteUrl)
  }

  // start camera rotation after animation ends
  async function onAnimationEnd() {
    if (preview.camera !== AvatarCamera.STATIC) {
      const camera = scene.cameras[0] as ArcRotateCamera
      startAutoRotateBehavior(camera, preview)
    }
    if (loop) {
      // keep playing idle animation on loop
      playEmote(scene, assets, preview)
    }
  }

  // play emote animation
  try {
    const emoteAnimationGroup = new AnimationGroup('emote', scene)
    for (const asset of assets) {
      // store all the transform nodes in a map, there can be repeated node ids
      // if a wearable has multiple representations, so for each id we keep an array of nodes
      const nodes = asset.container.transformNodes.reduce((map, node) => {
        const list = map.get(node.id) || []
        list.push(node)
        return map.set(node.id, list)
      }, new Map<string, TransformNode[]>())
      // apply each targeted animation from the emote asset container to the transform nodes of all the wearables
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
    // play animation group and apply
    emoteAnimationGroup.play()
    emoteAnimationGroup.onAnimationEndObservable.addOnce(onAnimationEnd)
  } catch (error) {
    console.warn(`Could not play emote=${preview.emote}`, error)
  }
}

export function shouldPlayEmote(preview: AvatarPreview) {
  return preview.emote
}
