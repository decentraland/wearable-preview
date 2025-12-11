import mitt from 'mitt'
import { AnimationGroup, ArcRotateCamera, AssetContainer, Scene, TransformNode, Sound, Engine } from '@babylonjs/core'
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
import { shouldApplySocialEmoteAnimation } from './utils'

const loopedEmotes = [
  PreviewEmote.IDLE,
  PreviewEmote.MONEY,
  PreviewEmote.CLAP,
  PreviewEmote.WALK,
  PreviewEmote.RUN,
  PreviewEmote.JUMP,
]

let intervalId: number | undefined

function isLooped(emote: PreviewEmote) {
  return loopedEmotes.includes(emote)
}

export function buildEmoteUrl(emote: PreviewEmote) {
  let baseUrl = process.env.VITE_BASE_URL || ''
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
      `Could not find a valid content in representation for emote=${emote.id} and bodyShape=${config.bodyShape}`,
    )
  }
  return loadEmoteFromUrl(scene, content.url)
}

export function loadEmoteSound(scene: Scene, emote: EmoteDefinition, config: PreviewConfig) {
  const representation = getEmoteRepresentation(emote, config.bodyShape)
  const selectedSound = config.socialEmote ? config.socialEmote.audio : null
  return loadSound(scene, representation, selectedSound)
}

export async function playEmote(
  scene: Scene,
  assets: Asset[],
  config: PreviewConfig,
  twinMap: Map<TransformNode, TransformNode> | undefined,
): Promise<IEmoteController | undefined> {
  // load asset container for emote
  let container: AssetContainer | undefined
  let loop = !!config.emote && isLooped(config.emote)
  let sound = null

  // if target item is emote, play that one
  if (config.item && isEmote(config.item)) {
    try {
      container = await loadEmoteFromWearable(scene, config.item as EmoteDefinition, config)
      loop = config.socialEmote ? config.socialEmote.loop : config.item.emoteDataADR74.loop
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
    // In some cases, the prop animation will start playing on loop when loaded, event though the avatar
    // animation is not running. This is to stop all possible animations before creating emote animation group
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
      // Store all transform nodes in a map by name for quick lookup
      const nodesByName = new Map<string, TransformNode[]>()

      // Include both transform nodes and regular nodes
      const allNodes = [...asset.container.transformNodes, ...asset.container.meshes]
      for (const node of allNodes) {
        // Strip any .# or .00# suffix from the node name for matching
        const baseName = node.name.replace(/\.\d+$/, '')
        const list = nodesByName.get(baseName) || []
        list.push(node)
        nodesByName.set(baseName, list)
      }

      // apply each targeted animation from the emote asset container to the transform nodes of all the wearables
      if (container && container.animationGroups.length > 0) {
        for (const animationGroup of container.animationGroups) {
          // Social emote logic: filter animations based on socialEmote configuration
          if (config.socialEmote) {
            // Check if this animation group should be applied based on social emote config
            const shouldApplyAnimation = shouldApplySocialEmoteAnimation(animationGroup, config.socialEmote)
            if (!shouldApplyAnimation) {
              continue // Skip this animation group
            }
          }
          for (const targetedAnimation of animationGroup.targetedAnimations) {
            const animation = targetedAnimation.animation.clone()
            const target = targetedAnimation.target as TransformNode

            // Ensure we copy all keyframes exactly
            const keys = targetedAnimation.animation.getKeys()
            animation.setKeys([...keys])

            if (config.socialEmote) {
              const isAvatarAnimation =
                config.socialEmote.Armature?.animation &&
                animationGroup.name.toLowerCase().startsWith(config.socialEmote.Armature.animation.toLowerCase())

              const isAvatarOtherAnimation =
                config.socialEmote.Armature_Other?.animation &&
                animationGroup.name.toLowerCase().startsWith(config.socialEmote.Armature_Other.animation.toLowerCase())

              const isAvatarPropAnimation =
                config.socialEmote.Armature_Prop?.animation &&
                animationGroup.name.toLowerCase().startsWith(config.socialEmote.Armature_Prop.animation.toLowerCase())

              if (isAvatarAnimation && !isAvatarOtherAnimation && !isAvatarPropAnimation) {
                //   // Strip any .# suffix from target name for matching
                const targetBaseName = target.name.replace(/\.\d+$/, '')
                const matchingNodes = nodesByName.get(targetBaseName) || []

                if (matchingNodes.length > 0) {
                  // Apply animation to all matching nodes
                  for (const node of matchingNodes) {
                    const nodeAnimation = animation.clone()
                    nodeAnimation.setKeys([...keys])
                    emoteAnimationGroup.addTargetedAnimation(nodeAnimation, node)
                  }
                } else {
                  console.warn('No matching bone found for', target.name)
                }
              } else if (isAvatarOtherAnimation) {
                const targetBaseName = target.name.replace(/\.\d+$/, '')
                const matchingNodes = nodesByName.get(targetBaseName) || []

                if (matchingNodes.length > 0) {
                  // Apply animation to all matching nodes
                  for (const node of matchingNodes) {
                    const twinNode = twinMap?.get(node as TransformNode)
                    if (!twinNode) {
                      // console.warn('No twin node found for', node.name)
                      continue
                    }
                    const nodeAnimation = animation.clone()
                    nodeAnimation.setKeys([...keys])

                    emoteAnimationGroup.addTargetedAnimation(nodeAnimation, twinNode)
                  }
                } else {
                  console.warn('No matching bone found for', target.name)
                }
              } else if (isAvatarPropAnimation) {
                emoteAnimationGroup.addTargetedAnimation(animation, target)
              }
            } else {
              // Determine if this is an avatar animation based on three criteria:
              // 1. Single animation case: If the emote only has one animation group, it must be meant for the avatar
              //    (props always come as additional animation groups)
              // 2. Group name: If the animation group's name contains "avatar", it's explicitly marked for the avatar
              //    (e.g., "Horse_Avatar" for the riding animation)
              // 3. Target name: If the animated node starts with "Avatar_", it's part of the avatar skeleton
              //    (e.g., "Avatar_Head", "Avatar_Spine", etc.)
              const isAvatarAnimation =
                container.animationGroups.length === 1 ||
                animationGroup.name.toLowerCase().includes('avatar') ||
                target.name.startsWith('Avatar_')

              if (isAvatarAnimation) {
                // Strip any .# suffix from target name for matching
                const targetBaseName = target.name.replace(/\.\d+$/, '')
                const matchingNodes = nodesByName.get(targetBaseName) || []

                if (matchingNodes.length > 0) {
                  // Apply animation to all matching nodes
                  for (const node of matchingNodes) {
                    const nodeAnimation = animation.clone()
                    nodeAnimation.setKeys([...keys])
                    emoteAnimationGroup.addTargetedAnimation(nodeAnimation, node)
                  }
                } else {
                  console.warn('No matching bone found for', target.name)
                }
              } else {
                emoteAnimationGroup.addTargetedAnimation(animation, target)
              }
            }
          }
        }
      }
    }

    // play animation group and apply
    emoteAnimationGroup.onAnimationGroupEndObservable.addOnce(onAnimationEnd)
    const controller = createController(emoteAnimationGroup, loop, sound, config.item as EmoteDefinition)

    if (config.camera === PreviewCamera.STATIC) {
      controller.stop() // we call the stop here to freeze the animation at frame 0, otherwise the avatar would be on T-pose
    }

    return controller
  } catch (error) {
    console.warn(`Could not play emote=${config.emote}`, error)
  }
}

function createController(
  animationGroup: AnimationGroup,
  loop: boolean,
  sound: Sound | null,
  emote: EmoteDefinition,
): IEmoteController {
  Engine.audioEngine.useCustomUnlockedButton = true
  Engine.audioEngine.setGlobalVolume(1)
  let fromSecond: number | undefined = undefined
  let fromGoTo = false

  async function getLength() {
    // if there's no animation, it should return 0
    return Math.max(animationGroup.to, 0)
  }

  async function isPlaying() {
    return animationGroup.isPlaying
  }

  async function hasSound() {
    return !!sound
  }

  async function goTo(seconds: number) {
    fromGoTo = true
    const playing = await isPlaying()
    if (playing) {
      animationGroup.pause()
    }
    // for some reason the start() method doesn't work as expected if playing, so I need to stop it first
    animationGroup.stop()
    // I had to use this hack because the native goToFrame would not work as expected :/
    animationGroup.start(false, 1, seconds, seconds, false)
    fromSecond = seconds
    // Set again the fromGoTo here because the `stop` event is emitted twice
    fromGoTo = true

    if (playing) {
      play()
    }
  }

  async function play() {
    if (!(await isPlaying())) {
      if (fromSecond) {
        animationGroup.start(loop, 1, fromSecond, await getLength(), false)
        if (sound) {
          sound.stop()
          // This is a hack to solve a bug in babylonjs version. This was finally fixed in Babylon PR: #13455.
          // TODO: update babylon major version
          sound['_startOffset'] = fromSecond
          sound.play()
        }
        fromSecond = 0
      } else {
        animationGroup.play(loop)
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
    Engine.audioEngine.unlock()
    Engine.audioEngine.setGlobalVolume(1)
    if (animationGroup.isPlaying && !sound.isPlaying) {
      sound.play(undefined, animationGroup.targetedAnimations[0].animation.runtimeAnimations[0].currentFrame)
    }
  }

  async function disableSound() {
    if (!sound) return
    Engine.audioEngine.setGlobalVolume(0)
  }

  async function isSocialEmote() {
    return (
      emote &&
      emote.emoteDataADR74 &&
      !!emote.emoteDataADR74.startAnimation &&
      !!emote.emoteDataADR74.outcomes &&
      emote.emoteDataADR74.outcomes.length > 0
    )
  }

  async function getSocialEmoteAnimations() {
    return (await isSocialEmote())
      ? [
          {
            title: 'Start Animation',
            ...emote.emoteDataADR74.startAnimation!,
          },
          ...emote.emoteDataADR74.outcomes!.map((outcome) => ({
            title: outcome.title,
            loop: outcome.loop,
            audio: outcome.audio,
            ...outcome.clips,
          })),
        ]
      : null
  }

  // Temporary typed events.
  type Events = {
    [PreviewEmoteEventType.ANIMATION_PLAY]: void
    [PreviewEmoteEventType.ANIMATION_PAUSE]: void
    [PreviewEmoteEventType.ANIMATION_LOOP]: void
    [PreviewEmoteEventType.ANIMATION_END]: void
    [PreviewEmoteEventType.ANIMATION_PLAYING]: { length: number }
  }

  const events = mitt<Events>()

  // Emit the PreviewEmoteEventType.ANIMATION_PLAYING event with the current playing frame
  const emitPlayingEvent = () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
    return window.setInterval(async () => {
      // Avoid emitting the event when the animation is paused or using GoTo because the masterFrame returns 0 for each request
      if ((await isPlaying()) && animationGroup.animatables[0].masterFrame > 0) {
        return events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, {
          length: animationGroup.animatables[0]?.masterFrame,
        })
      }
    }, 10)
  }

  const clearEmitPlayingEvent = () => {
    clearInterval(intervalId)
    if (!fromGoTo) {
      events.emit(PreviewEmoteEventType.ANIMATION_PLAYING, {
        length: animationGroup.to,
      })
    }
  }

  // forward observable events to event emitter
  animationGroup.onAnimationGroupPlayObservable.add(() => {
    intervalId = emitPlayingEvent()
    return events.emit(PreviewEmoteEventType.ANIMATION_PLAY)
  })
  animationGroup.onAnimationGroupPauseObservable.add(() => {
    events.emit(PreviewEmoteEventType.ANIMATION_PAUSE)
  })
  animationGroup.onAnimationGroupLoopObservable.add(() => {
    sound?.stop()
    sound?.play()
    // It's required to stop and start a looping animation again from 0 when using the Go To feature,
    // otherwise the animation will continue playing from the GoTo chosen frame
    if (fromGoTo) {
      stop()
      play()
      fromGoTo = false
    }
    return events.emit(PreviewEmoteEventType.ANIMATION_LOOP)
  })
  animationGroup.onAnimationGroupEndObservable.add(() => {
    // Send the last frame when the animation ends and the event: end is not emitted by a goTo
    clearEmitPlayingEvent()
    if (!loop) {
      fromGoTo = false
    }
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
    emote,
    isSocialEmote,
    getSocialEmoteAnimations,
  }
}
