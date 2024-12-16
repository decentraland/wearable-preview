import { Color3, Color4, DynamicTexture, Scene, Texture } from '@babylonjs/core'
import {
  PreviewConfig,
  PreviewType,
  BodyShape,
  IPreviewController,
  IEmoteController,
  WearableCategory,
} from '@dcl/schemas'
import { createInvalidEmoteController, isEmote } from '../emote'
import { getBodyShape } from './body'
import { getSlots } from './slots'
import { playEmote } from './emote'
import { applyFacialFeatures, getFacialFeatures } from './face'
import { setupMappings } from './mappings'
import { Asset, center, createScene } from './scene'
import { isFacialFeature, isModel, isSuccesful } from './utils'
import { loadWearable } from './wearable'
import { createShaderMaterial } from './explorer-alpha-shader'

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */

function createTexture(scene: Scene, hexColor: string) {
  const texture = new DynamicTexture('dynamicTexture', { width: 512, height: 512 }, scene)
  const context = texture.getContext()

  const color = Color3.FromHexString(hexColor).toLinearSpace()
  context.fillStyle = `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(
    color.b * 255
  )}, 1)`
  context.fillRect(0, 0, 512, 512)
  texture.update()

  return texture
}

function applyMaterialToMeshes(
  materials: any[],
  scene: any,
  mappings: any,
  category: string,
  config: PreviewConfig
): void {
  materials.forEach((material) => {
    // here we need to create the specific material first and then apply to the meshMap of the Material
    const parsedUrl = new URL(material?.albedoTexture?.url)
    const pathname = parsedUrl.pathname
    const fileName = pathname.split('/').pop()

    let texture
    let shaderMaterial = createShaderMaterial(scene, category + Date.now() + Math.random())

    if (fileName === undefined) return
    const fileUrl = mappings[fileName]

    switch (category) {
      case WearableCategory.BODY_SHAPE:
        texture = createTexture(scene, config.skin)
        shaderMaterial.setTexture('textureSampler', texture)
        shaderMaterial.setInt('materialType', 0)
        shaderMaterial.setFloat('alpha', 0.7)
        break
      case WearableCategory.HAIR:
        texture = createTexture(scene, config.hair)
        shaderMaterial.setTexture('textureSampler', texture)
        shaderMaterial.setInt('materialType', 0)
        shaderMaterial.setFloat('alpha', 1)
        break
      case WearableCategory.UPPER_BODY:
        texture = new Texture(fileUrl || '', scene)
        shaderMaterial.setTexture('textureSampler', texture)
        break
      case WearableCategory.LOWER_BODY:
        if (fileName?.includes('SkinBase')) {
          texture = createTexture(scene, config.skin)
          shaderMaterial.setTexture('textureSampler', texture)
          shaderMaterial.setInt('materialType', 0)
          shaderMaterial.setFloat('alpha', 0.7)
        } else {
          texture = new Texture(fileUrl || '', scene)
          shaderMaterial.setTexture('textureSampler', texture)
          shaderMaterial.setFloat('alpha', 1)
        }
        break
      case WearableCategory.FEET:
        if (!fileName?.includes('SkinBase')) {
          texture = new Texture(fileUrl || '', scene)
          shaderMaterial.setTexture('textureSampler', texture)
          shaderMaterial.setInt('materialType', 1)
        } else {
          texture = createTexture(scene, config.skin)
          shaderMaterial.setTexture('textureSampler', texture)
          shaderMaterial.setInt('materialType', 1)
          shaderMaterial.setFloat('alpha', 0.7)
        }
        shaderMaterial.needDepthPrePass = true
        break
      default:
    }

    console.log(shaderMaterial, fileName)
    const meshMap = material?.meshMap
    if (meshMap && typeof meshMap === 'object') {
      for (const mesh of Object.values(meshMap) as any) {
        if (mesh && mesh.material) {
          mesh.material = shaderMaterial
          mesh.computeBonesUsingShaders = false
          scene.addMesh(mesh)
        } else {
          console.warn('Mesh or material not found:', mesh)
        }
      }
    } else {
      console.warn('meshMap is invalid or not found in material:', material)
    }
  })
}

export async function render(canvas: HTMLCanvasElement, config: PreviewConfig): Promise<IPreviewController> {
  // create the root scene
  const [scene, sceneController, engine] = await createScene(canvas, config)

  try {
    // setup the mappings for all the contents
    const mappings = setupMappings(config)

    // emote controller
    let emoteController: IEmoteController

    // create promises for both avatars
    const avatarPromises: Promise<void | Asset>[] = []

    if (config.type === PreviewType.AVATAR) {
      // get slots
      const slots = getSlots(config)

      // get wearables
      const wearables = Array.from(slots.values())

      //load wearables
      for (const wearable of wearables.filter(isModel)) {
        const promise = loadWearable(scene, wearable, config.bodyShape, config.skin, config.hair).catch((error) => {
          console.warn(error.message)
        })
        avatarPromises?.push(promise)
      }

      const assets = (await Promise.all(avatarPromises)).filter(isSuccesful)

      // load assets in scene using shader Material
      for (const asset of assets) {
        applyMaterialToMeshes(asset?.container?.materials, scene, mappings, asset?.wearable?.data?.category, config)
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

    scene.getOutlineRenderer()

    // milestone 2
    const meshIDsToOutline = [
      'M_Hair_Standard_01',
      'M_uBody_Hoodie_01',
      'M_uBody_Hoodie_02',
      'M_lBody_LongPants_01_primitive0',
      'M_lBody_LongPants_01_primitive1',
      'M_Feet_Sneakers_01_primitive0',
      'M_Feet_Sneakers_02',
    ]

    console.log('scene', scene)

    engine.runRenderLoop(() => {
      scene.render()
    })

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
