import { Color4, Mesh, TransformNode } from '@babylonjs/core'
import {
  PreviewConfig,
  PreviewType,
  BodyShape,
  IPreviewController,
  IEmoteController,
  ArmatureId,
  EmoteClip,
} from '@dcl/schemas'
import { createInvalidEmoteController, isEmote } from '../emote'
import { getBodyShape } from './body'
import { getSlots } from './slots'
import { playEmote } from './emote'
import { applyFacialFeatures, getFacialFeatures } from './face'
import { setupMappings } from './mappings'
import { Asset, center, createScene } from './scene'
import { buildTwinMapFromContainer, isFacialFeature, isModel, isSuccesful } from './utils'
import { loadWearable } from './wearable'

// Extended options type to include socialEmote
type SocialEmote =
  | (Partial<Record<ArmatureId, EmoteClip>> & {
      loop: boolean
      audio?: string
    })
  | undefined

// Extended config type to include socialEmote
interface ExtendedPreviewConfig extends PreviewConfig {
  socialEmote?: SocialEmote | null
}

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param config
 */
export async function render(canvas: HTMLCanvasElement, config: ExtendedPreviewConfig): Promise<IPreviewController> {
  // create the root scene
  const [scene, sceneController] = await createScene(canvas, config)
  try {
    // setup the mappings for all the contents
    setupMappings(config)

    // emote controller
    let emoteController: IEmoteController

    // load all the wearables into the root scene
    const promises: Promise<void | Asset>[] = []

    if (config.type === PreviewType.AVATAR) {
      // get slots
      const slots = getSlots(config)

      // get wearables
      const wearables = Array.from(slots.values())

      for (const wearable of wearables.filter(isModel)) {
        const promise = loadWearable(scene, wearable, config.bodyShape, config.skin, config.hair).catch((error) => {
          console.warn(error.message)
        })
        promises.push(promise)
      }

      let parentOther: Mesh | null = null
      if (config.socialEmote && config.socialEmote.Armature_Other) parentOther = new Mesh('parent_other', scene)

      const twinMap = new Map<TransformNode, TransformNode>()

      const assets = (await Promise.all(promises)).filter(isSuccesful)

      // add all assets to scene
      for (const asset of assets) {
        // 1) Add originals to the scene
        asset.container.addAllToScene()

        // 2) If we need the "other" avatar now, instantiate a duplicate hierarchy
        if (parentOther) {
          const inst = asset.container.instantiateModelsToScene((name) => `${name}_Other`)
          // Parent the duplicated roots under `parent_other`
          for (const cloneRoot of inst.rootNodes as TransformNode[]) {
            cloneRoot.setParent(parentOther)
          }
          // Build twin mapping original -> clone (useful for animation targeting)
          const map = buildTwinMapFromContainer(asset.container, inst.rootNodes as TransformNode[])
          for (const [k, v] of map) twinMap.set(k, v)
        }
      }

      // build avatar
      const bodyShape = getBodyShape(assets)
      if (bodyShape) {
        // apply facial features
        const features = wearables.filter(isFacialFeature)
        const { eyes, eyebrows, mouth } = await getFacialFeatures(scene, features, config.bodyShape)
        applyFacialFeatures(scene, bodyShape, eyes, eyebrows, mouth, config)
      }

      // play emote
      emoteController = (await playEmote(scene, assets, config, twinMap)) || createInvalidEmoteController() // default to invalid emote controller if there is an issue with the emote, but let the rest of the preview keep working
    } else {
      const wearable = config.item
      if (wearable && !isEmote(wearable)) {
        try {
          // try loading with the required body shape
          const asset = await loadWearable(scene, wearable, config.bodyShape, config.skin, config.hair)
          asset.container.addAllToScene()
        } catch (error) {
          // default to other body shape if failed
          const asset = await loadWearable(
            scene,
            wearable,
            config.bodyShape === BodyShape.MALE ? BodyShape.FEMALE : BodyShape.MALE,
            config.skin,
            config.hair,
          )
          asset.container.addAllToScene()
        }
      }

      // can't use emote controller if PreviewType is not "avatar"
      emoteController = createInvalidEmoteController()
    }

    // center the root scene into the camera
    if (config.centerBoundingBox) {
      center(scene)
    }

    // return preview controller
    const controller: IPreviewController = {
      scene: sceneController,
      emote: emoteController,
    }
    return controller
  } catch (error) {
    // remove background on error
    scene.clearColor = new Color4(0, 0, 0, 0)
    throw error
  }
}
