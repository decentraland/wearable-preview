import { Color3, Color4, Texture } from '@babylonjs/core'
import { PreviewConfig, PreviewType, BodyShape, IPreviewController, IEmoteController } from '@dcl/schemas'
import { createInvalidEmoteController, isEmote } from '../emote'
import { getBodyShape } from './body'
import { getSlots } from './slots'
import { playEmote } from './emote'
import { applyFacialFeatures, getFacialFeatures } from './face'
import { setupMappings } from './mappings'
import { Asset, center, createScene } from './scene'
import { isFacialFeature, isModel, isSuccesful } from './utils'
import { loadWearable } from './wearable'
import { createShader } from './explorer-alpha-shader'

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */
export async function render(canvas: HTMLCanvasElement, config: PreviewConfig): Promise<IPreviewController> {
  // create the root scene
  const [scene, sceneController] = await createScene(canvas, config)

  // create Shader
  const shaderMaterial = createShader(scene)
  const mainTexture = new Texture('logo.png', scene)

  // Add Texture to the Shader
  if (shaderMaterial) {
    shaderMaterial?.setTexture('textureSampler', mainTexture)
  }

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
        const { eyes, eyebrows, mouth } = await getFacialFeatures(scene, features, config.bodyShape)
        applyFacialFeatures(scene, bodyShape, eyes, eyebrows, mouth, config)
      }

      // play emote
      emoteController = (await playEmote(scene, assets, config)) || createInvalidEmoteController() // default to invalid emote controller if there is an issue with the emote, but let the rest of the preview keep working
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
            config.hair
          )
          asset.container.addAllToScene()
        }
      }

      // can't use emote controller if PreviewType is not "avatar"
      emoteController = createInvalidEmoteController()
    }

    // Apply Shader
    if (shaderMaterial) {
      for (const mesh of scene.meshes) {
        if (mesh.material !== shaderMaterial) {
          // Dispose of the existing material if it exists
          mesh.material?.dispose();

          // Assign the new shader material
          mesh.material = shaderMaterial;
        }

        mesh.material = shaderMaterial;
        mesh.computeBonesUsingShaders = false;
        // mesh.renderOutline = true;
        mesh.outlineColor = new Color3(0.95, 0.95, 0.95) // Set the outline color to red
      }
    }

    // center the root scene into the camera
    if (config.centerBoundingBox) {
      center(scene)
    }

    scene.registerBeforeRender(() => {
      scene.meshes.forEach((mesh) => {
        mesh.rotation.y += 0.01 // Adjust rotation speed as needed
      })
    })
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
