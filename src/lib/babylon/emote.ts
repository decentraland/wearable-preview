import { EventEmitter } from 'events'
import {
  AnimationGroup,
  ArcRotateCamera,
  AssetContainer,
  Scene,
  TransformNode,
  Vector3,
  Sound,
  Engine,
  AudioEngine,
} from '@babylonjs/core'
import {
  IEmoteController,
  PreviewCamera,
  PreviewConfig,
  PreviewEmote,
  EmoteDefinition,
  PreviewEmoteEventType,
} from '@dcl/schemas'
import { isEmote } from '../emote'
import { startAutoRotateBehavior } from './camera'
import { Asset, loadAssetContainer, loadSound } from './scene'
import { getEmoteRepresentation } from '../representation'

const loopedEmotes = [PreviewEmote.IDLE, PreviewEmote.MONEY, PreviewEmote.CLAP]

let intervalId: number | undefined

function isLooped(emote: PreviewEmote) {
  return loopedEmotes.includes(emote)
}

function getFramesPerSecond(animationGroup: AnimationGroup) {
  return animationGroup.targetedAnimations[0].animation.framePerSecond
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

export async function loadEmoteFromWearable(scene: Scene, emote: EmoteDefinition, config: PreviewConfig) {
  const representation = getEmoteRepresentation(emote, config.bodyShape)
  const content = representation.contents.find((content) => content.key === representation.mainFile)
  if (!content) {
    throw new Error(
      `Could not find a valid content in representation for emote=${emote.id} and bodyShape=${config.bodyShape}`
    )
  }
  return loadEmoteFromUrl(scene, content.url)
}

export function loadEmoteSound(scene: Scene, emote: EmoteDefinition, config: PreviewConfig) {
  const representation = getEmoteRepresentation(emote, config.bodyShape)
  return loadSound(scene, representation)
}

export async function playEmote(scene: Scene, assets: Asset[], config: PreviewConfig) {
  // load asset container for emote
  let container: AssetContainer | undefined
  let loop = !!config.emote && isLooped(config.emote)
  let sound = null

  // if target item is emote, play that one
  if (config.item && isEmote(config.item)) {
    try {
      container = await loadEmoteFromWearable(scene, config.item as EmoteDefinition, config)
      loop = config.item.emoteDataADR74.loop
      sound = await loadEmoteSound(scene, config.item as EmoteDefinition, config)
    } catch (error) {
      console.warn(`Could not load emote=${config.item.id}`)
    }
  }
  if (!container && config.emote) {
    const emoteUrl = buildEmoteUrl(config.emote)
    container = await loadEmoteFromUrl(scene, emoteUrl)
  }

  if (container && container.animationGroups.length > 1) {
    container.addAllToScene()
    scene.stopAllAnimations()
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
      const nodes = [...asset.container.transformNodes, ...(container?.transformNodes || [])].reduce((map, node) => {
        const list = map.get(node.id) || []
        list.push(node)
        // Initialize position when starting an animation to avoid wearables misplaced
        if (container && config.emote) {
          node.position = new Vector3(0, 0, 0)
        }
        return map.set(node.id, list)
      }, new Map<string, TransformNode[]>())
      // apply each targeted animation from the emote asset container to the transform nodes of all the wearables
      if (container && container.animationGroups.length > 0) {
        for (const animationGroup of container.animationGroups) {
          for (const targetedAnimation of animationGroup.targetedAnimations) {
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
    }
    // play animation group and apply
    emoteAnimationGroup.onAnimationGroupEndObservable.addOnce(onAnimationEnd)
    const controller = createController(emoteAnimationGroup, loop, sound)

    if (config.camera === PreviewCamera.STATIC) {
      controller.stop() // we call the stop here to freeze the animation at frame 0, otherwise the avatar would be on T-pose
    }

    return controller
  } catch (error) {
    console.warn(`Could not play emote=${config.emote}`, error)
  }
}

function createController(animationGroup: AnimationGroup, loop: boolean, sound: Sound | null): IEmoteController {
  const audioEngine = Engine.audioEngine || new AudioEngine()

  audioEngine.useCustomUnlockedButton = true
  audioEngine.setGlobalVolume(0)
  let from: number | null = null
  async function getLength() {
    const framesPerSecond = getFramesPerSecond(animationGroup)
    // if there's no animation, it should return 0
    return Math.max(animationGroup.to / framesPerSecond, 0)
  }

  async function isPlaying() {
    return animationGroup.isPlaying
  }

  async function hasSound() {
    return !!sound
  }

  async function goTo(seconds: number) {
    const frame = seconds * getFramesPerSecond(animationGroup)
    animationGroup.goToFrame(frame)
    from = seconds
  }

  async function play() {
    if (!(await isPlaying())) {
      animationGroup.play(loop)
      if (from !== null) {
        sound?.stop()
        sound?.play(undefined, from, 0)
        from = null
      } else {
        sound?.play()
      }
    }
  }

  async function pause() {
    if (await isPlaying()) {
      animationGroup.pause()
      sound?.pause()
    }
  }

  async function stop() {
    animationGroup.goToFrame(0)
    animationGroup.stop()
    sound?.stop()
  }

  async function enableSound() {
    if (!sound) return
    audioEngine.unlock()
    audioEngine.setGlobalVolume(1)
    if (animationGroup.isPlaying && !sound.isPlaying) {
      const framesPerSecond = getFramesPerSecond(animationGroup)
      sound.play(undefined, animationGroup.animatables[0].masterFrame / framesPerSecond)
    }
  }

  async function disableSound() {
    if (!sound) return
    audioEngine.setGlobalVolume(0)
  }

  const events = new EventEmitter()

  // Emit the PreviewEmoteEventType.ANIMATION_PLAYING event with the current playing frame
  const emitPlayingEvent = () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
    return window.setInterval(async () => {
      // Avoid emitting the event when the animation is paused or using GoTo because the masterFrame returns 0 for each request
      if ((await isPlaying()) && animationGroup.animatables[0].masterFrame > 0) {
        const frame = animationGroup.targetedAnimations[0].animation.runtimeAnimations[0].currentFrame
        const framesPerSecond = getFramesPerSecond(animationGroup)
        return events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, {
          length: frame / framesPerSecond,
        })
      }
    }, 10)
  }

  const clearEmitPlayingEvent = () => {
    clearInterval(intervalId)
    events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, {
      length: animationGroup.to,
    })
  }

  // forward observable events to event emitter
  animationGroup.onAnimationGroupPlayObservable.add(() => {
    intervalId = emitPlayingEvent()
    return events.emit(PreviewEmoteEventType.ANIMATION_PLAY)
  })
  animationGroup.onAnimationGroupPauseObservable.add(() => {
    sound?.pause()
    events.emit(PreviewEmoteEventType.ANIMATION_PAUSE)
  })
  animationGroup.onAnimationGroupLoopObservable.add(() => {
    from = null
    sound?.stop()
    sound?.play()
    return events.emit(PreviewEmoteEventType.ANIMATION_LOOP)
  })
  animationGroup.onAnimationGroupEndObservable.add(() => {
    from = null
    sound?.stop()
    // Send the last frame when the animation ends and the event: end is not emitted by a goTo
    clearEmitPlayingEvent()
    return events.emit(PreviewEmoteEventType.ANIMATION_END)
  })

  return {
    getLength,
    isPlaying,
    goTo,
    play,
    pause,
    stop,
    enableSound,
    disableSound,
    hasSound,
    events,
  }
}
