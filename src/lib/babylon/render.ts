import { Color4, HighlightLayer, Texture } from '@babylonjs/core'
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
import { createOutlineShader } from './explorer-alpha-shader/OutlineShader'

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */
export async function render(canvas: HTMLCanvasElement, config: PreviewConfig): Promise<IPreviewController> {
  // create the root scene
  const [scene, sceneController, engine] = await createScene(canvas, config)

  // create shaders - feet , hands , body , pants , hairs
  const hairShaderMaterial = createShader(scene, 'hair')
  const upperBodyShaderMaterial = createShader(scene, 'hoodie')
  const lowerBodyShaderMaterial = createShader(scene, 'pants')
  const feetShaderMaterial = createShader(scene, 'shoes')

  const outlineShaderMaterial = createOutlineShader(scene, 'outlinedadada')

  const hl = new HighlightLayer('hl1', scene)

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

      // add all assets to  scene and create shaderMaterial based on bodyPart
      for (const asset of assets) {
        asset.container.addAllToScene()

        // Dynamically create a texture for the asset
        const texture = new Texture(asset.wearable.thumbnail, scene)

        texture.onLoadObservable.add(() => {
          console.log(`${'asset name'} texture loaded successfully.`)
        })

        switch (asset?.wearable?.data?.category) {
          case 'body_shape':
            break

          case 'hair':
            hairShaderMaterial.setTexture('sampler_MainTex', texture)
            break

          case 'upper_body':
            upperBodyShaderMaterial.setTexture('sampler_MainTex', texture)
            break

          case 'lower_body':
            lowerBodyShaderMaterial.setTexture('sampler_MainTex', texture)
            break

          case 'feet':
            feetShaderMaterial.setTexture('sampler_MainTex', texture)
            break

          default:
            console.warn(`Unknown asset type: ${asset.wearable.name}`)
            break
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

    const meshIDsToOutline = [
      'M_Hair_Standard_01',
      'M_uBody_Hoodie_01',
      'M_uBody_Hoodie_02',
      'M_lBody_LongPants_01_primitive0',
      'M_lBody_LongPants_01_primitive1',
      'M_Feet_Sneakers_01_primitive0',
      'M_Feet_Sneakers_02',
    ]

    // center the root scene into the camera
    if (config.centerBoundingBox) {
      center(scene)
    }

    engine.runRenderLoop(() => {
      // First Pass: Render Outline Shader
      outlineShaderMaterial.backFaceCulling = false
      // Provide the base color
      outlineShaderMaterial.setColor4('_BaseColor', new Color4(1, 0.75, 0.8, 1))

      for (const mesh of scene.meshes) {
        if (meshIDsToOutline?.includes(mesh?.id)) {
          mesh.material = outlineShaderMaterial // Assign the outline shader material
        }
      }

      engine.clear(scene.clearColor, true, true)
      scene.render()

      // Apply ShaderMaterials
      for (const mesh of scene.meshes) {
        switch (mesh?.id) {
          case 'M_Hair_Standard_01':
            mesh.material = hairShaderMaterial
            break
          case 'M_uBody_Hoodie_01':
            mesh.material = upperBodyShaderMaterial
            break
          case 'M_uBody_Hoodie_02':
            mesh.material = upperBodyShaderMaterial
            break
          case 'M_lBody_LongPants_01_primitive0':
            mesh.material = lowerBodyShaderMaterial
            break
          case 'M_lBody_LongPants_01_primitive1':
            mesh.material = lowerBodyShaderMaterial
            break
          case 'M_Feet_Sneakers_01_primitive0':
            mesh.material = feetShaderMaterial
            break
          case 'M_Feet_Sneakers_02':
            mesh.material = feetShaderMaterial
            break

          default:
            // Optional: Handle cases where no match is found
            break
        }
        hl.innerGlow = false
        mesh.computeBonesUsingShaders = false
      }
      engine.clear(undefined, true, true)
      scene.render()
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
