import { EventEmitter } from 'events'
import { AnimationGroup, ArcRotateCamera, AssetContainer, Scene, TransformNode } from '@babylonjs/core'
import {
  IEmoteController,
  PreviewCamera,
  PreviewConfig,
  PreviewEmote,
  EmoteDefinition,
  PreviewEmoteEventType,
} from '@dcl/schemas'
import { isEmote } from '../emote'
import { getRepresentation } from '../representation'
import { startAutoRotateBehavior } from './camera'
import { Asset, loadAssetContainer } from './scene'

const loopedEmotes = [PreviewEmote.IDLE, PreviewEmote.MONEY, PreviewEmote.CLAP]

function isLooped(emote: PreviewEmote) {
  return loopedEmotes.includes(emote)
}

export function buildEmoteUrl(emote: PreviewEmote) {
  let baseUrl = process.env.PUBLIC_URL || ''
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/'
  }
  const path = `./emotes/${emote}.glb`
  const url = baseUrl.startsWith('http') ? new URL(path, baseUrl).href : path
  return url
}

export async function loadEmoteFromUrl(scene: Scene, url: string) {
  const container = await loadAssetContainer(scene, url)
  if (container.animationGroups.length === 0) {
    throw new Error(`No animation groups found for emote with url=${url}`)
  }
  return container
}

export async function loadEmoteFromWearable(scene: Scene, wearable: EmoteDefinition, config: PreviewConfig) {
  const representation = getRepresentation(wearable, config.bodyShape)
  const content = representation.contents.find((content) => content.key === representation.mainFile)
  if (!content) {
    throw new Error(
      `Could not find a valid content in representation for wearable=${wearable.id} and bodyShape=${config.bodyShape}`
    )
  }
  return loadEmoteFromUrl(scene, content.url)
}

export async function playEmote(scene: Scene, assets: Asset[], config: PreviewConfig) {
  // load asset container for emote
  let container: AssetContainer | undefined
  let loop = !!config.emote && isLooped(config.emote)

  // if target wearable is emote, play that one
  if (config.wearable && isEmote(config.wearable)) {
    try {
      container = await loadEmoteFromWearable(scene, config.wearable as EmoteDefinition, config)
      //TODO: remove this cast that supports the old emote entity
      loop =
        (config.wearable as any).emoteDataV0 !== undefined
          ? !!(config.wearable as any).emoteDataV0.loop
          : config.wearable.emoteDataADR74.loop
    } catch (error) {
      console.warn(`Could not load emote=${config.wearable.id}`)
    }
  } else if (config.wearables.some(isEmote)) {
    // if there's some emote in the wearables list, play the last one
    const emote = config.wearables.reverse().find(isEmote)!
    container = await loadEmoteFromWearable(scene, emote as EmoteDefinition, config)
    //TODO: remove this cast that supports the old emote entity
    loop = (emote as any).emoteDataV0 !== undefined ? !!(emote as any).emoteDataV0.loop : !!emote.emoteDataADR74?.loop
  }
  if (!container && config.emote) {
    const emoteUrl = buildEmoteUrl(config.emote)
    container = await loadEmoteFromUrl(scene, emoteUrl)
  }

  const emoteAnimationGroup = new AnimationGroup('emote', scene)

  // start camera rotation after animation ends
  function onAnimationEnd() {
    if (config.camera !== PreviewCamera.STATIC) {
      const camera = scene.cameras[0] as ArcRotateCamera
      startAutoRotateBehavior(camera, config)
    }
  }

  // play emote animation
  try {
    for (const asset of assets) {
      // store all the transform nodes in a map, there can be repeated node ids
      // if a wearable has multiple representations, so for each id we keep an array of nodes
      const nodes = asset.container.transformNodes.reduce((map, node) => {
        const list = map.get(node.id) || []
        list.push(node)
        return map.set(node.id, list)
      }, new Map<string, TransformNode[]>())
      // apply each targeted animation from the emote asset container to the transform nodes of all the wearables
      if (container && container.animationGroups.length > 0) {
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
    }
    // play animation group and apply
    emoteAnimationGroup.onAnimationGroupEndObservable.addOnce(onAnimationEnd)
    const controller = createController(emoteAnimationGroup, loop)

    if (config.camera === PreviewCamera.STATIC) {
      controller.stop() // we call the stop here to freeze the animation at frame 0, otherwise the avatar would be on T-pose
    }

    return controller
  } catch (error) {
    console.warn(`Could not play emote=${config.emote}`, error)
  }
}

function createController(animationGroup: AnimationGroup, loop: boolean): IEmoteController {
  let startFrom = 0

  async function getLength() {
    // if there's no animation, it should return 0
    return Math.max(animationGroup.to, 0)
  }

  async function isPlaying() {
    return animationGroup.isPlaying
  }

  async function goTo(seconds: number) {
    if (await isPlaying()) {
      animationGroup.pause()
      goTo(seconds)
      window.requestAnimationFrame(play)
    } else {
      // for some reason the start() method doesn't work as expected if playing, so I need to stop it first
      animationGroup.stop()
      // I had to use this hack because the native goToFrame would not work as expected :/
      animationGroup.start(false, 1, seconds, seconds, false)
      startFrom = seconds
    }
  }

  async function play() {
    if (!(await isPlaying())) {
      if (startFrom) {
        animationGroup.start(loop, 1, startFrom, await getLength(), false)
        startFrom = 0
      } else {
        animationGroup.play(loop)
      }
    }
  }

  async function pause() {
    if (await isPlaying()) {
      animationGroup.pause()
    }
  }

  async function stop() {
    if (await isPlaying()) {
      animationGroup.goToFrame(0)
      animationGroup.stop()
    }
  }

  const events = new EventEmitter()

  // forward observable events to event emitter
  animationGroup.onAnimationGroupPlayObservable.add(() => events.emit(PreviewEmoteEventType.ANIMATION_PLAY))
  animationGroup.onAnimationGroupPauseObservable.add(() => events.emit(PreviewEmoteEventType.ANIMATION_PAUSE))
  animationGroup.onAnimationGroupLoopObservable.add(() => events.emit(PreviewEmoteEventType.ANIMATION_LOOP))
  animationGroup.onAnimationGroupEndObservable.add(() => events.emit(PreviewEmoteEventType.ANIMATION_END))

  return {
    getLength,
    isPlaying,
    goTo,
    play,
    pause,
    stop,
    events,
  }
}
