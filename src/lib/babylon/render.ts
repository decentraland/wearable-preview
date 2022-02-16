import { AvatarPreview, AvatarPreviewType } from '../avatar'
import { getBodyShape } from './body'
import { getSlots } from './slots'
import { playEmote } from './emotes'
import { applyFacialFeatures, getFacialFeatures } from './face'
import { setupMappings } from './mappings'
import { Asset, center, createScene, loadWearable } from './scene'
import { isFacialFeature, isModel, isSuccesful } from './utils'

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */
export async function render(canvas: HTMLCanvasElement, preview: AvatarPreview) {
  // create the root scene
  const root = await createScene(canvas, preview)

  // setup the mappings for all the contents
  setupMappings(preview.wearables, preview.bodyShape)

  // get slots
  const slots = getSlots(preview)

  // load all the wearables into the root scene
  const promises: Promise<void | Asset>[] = []
  const wearables = Array.from(slots.values())
  for (const wearable of wearables.filter(isModel)) {
    const promise = loadWearable(root, wearable, preview.bodyShape, preview.skin, preview.hair).catch((error) => {
      console.warn(error.message)
    })
    promises.push(promise)
  }
  const assets = (await Promise.all(promises)).filter(isSuccesful)

  // add all assets to scene
  for (const asset of assets) {
    asset.container.addAllToScene()
  }

  if (preview.type === AvatarPreviewType.AVATAR) {
    // build avatar
    const bodyShape = getBodyShape(assets)
    // apply facial features
    const features = wearables.filter(isFacialFeature)
    const { eyes, eyebrows, mouth } = await getFacialFeatures(root, features, preview.bodyShape)
    applyFacialFeatures(root, bodyShape, eyes, eyebrows, mouth, preview)
    // play emote
    if (preview.emote) {
      await playEmote(root, assets, preview.emote)
    }
  }

  // center the root scene into the camera
  center(root)
}
