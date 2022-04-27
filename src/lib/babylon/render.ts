import { PreviewConfig, PreviewType, WearableBodyShape } from '@dcl/schemas'
import { getBodyShape } from './body'
import { getSlots } from './slots'
import { playEmote } from './emotes'
import { applyFacialFeatures, getFacialFeatures } from './face'
import { setupMappings } from './mappings'
import { Asset, center, createScene } from './scene'
import { isFacialFeature, isModel, isSuccesful } from './utils'
import { loadWearable } from './wearable'

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */
export async function render(canvas: HTMLCanvasElement, config: PreviewConfig) {
  // create the root scene
  const root = await createScene(canvas, config)

  // setup the mappings for all the contents
  setupMappings(config)

  // load all the wearables into the root scene
  const promises: Promise<void | Asset>[] = []

  if (config.type === PreviewType.AVATAR) {
    // get slots
    const slots = getSlots(config)

    // get wearables
    const wearables = Array.from(slots.values())

    for (const wearable of wearables.filter(isModel)) {
      const promise = loadWearable(root, wearable, config.bodyShape, config.skin, config.hair).catch((error) => {
        console.warn(error.message)
      })
      promises.push(promise)
    }
    const assets = (await Promise.all(promises)).filter(isSuccesful)

    // add all assets to scene
    for (const asset of assets) {
      asset.container.addAllToScene()
    }

    // build avatar
    const bodyShape = getBodyShape(assets)
    if (bodyShape) {
      // apply facial features
      const features = wearables.filter(isFacialFeature)
      const { eyes, eyebrows, mouth } = await getFacialFeatures(root, features, config.bodyShape)
      applyFacialFeatures(root, bodyShape, eyes, eyebrows, mouth, config)
    }

    // play emote
    await playEmote(root, assets, config)
  } else {
    if (!config.wearable) {
      throw new Error('No wearable to render')
    }
    const wearable = config.wearable
    try {
      // try loading with the required body shape
      const asset = await loadWearable(root, wearable, config.bodyShape, config.skin, config.hair)
      asset.container.addAllToScene()
    } catch (error) {
      // default to other body shape if failed
      const asset = await loadWearable(
        root,
        wearable,
        config.bodyShape === WearableBodyShape.MALE ? WearableBodyShape.FEMALE : WearableBodyShape.MALE,
        config.skin,
        config.hair
      )
      asset.container.addAllToScene()
    }
  }

  // center the root scene into the camera
  center(root)
}
