import { Color4, Texture } from '@babylonjs/core'
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

  const skinShaderMaterial = createShader(scene, 'skin')

  const outlineShaderMaterial = createOutlineShader(scene, 'outline')

  // upperBody
  const upperMainTexture = new Texture('/upper-MainTex', scene)
  // const upperNormalTexture = new Texture('/pants-normal', scene)
  upperBodyShaderMaterial.setTexture('sampler_MainTex', upperMainTexture)
  upperBodyShaderMaterial.setTexture('sampler_Emissive_Tex', upperMainTexture)

  // Lower Body
  const pantsMainTex = new Texture('/pants-maintex', scene)
  const pantsNormalTexture = new Texture('/pants-normal', scene)
  lowerBodyShaderMaterial.setTexture('sampler_MainTex', pantsMainTex)
  lowerBodyShaderMaterial.setTexture('sampler_NormalMap', pantsNormalTexture)

  // feet Part
  const feetMainTex = new Texture('/shoes-mainTex', scene)
  const feetNormalTexture = new Texture('/shoes-normalMap', scene)
  feetShaderMaterial.setTexture('sampler_MainTex', feetMainTex)
  feetShaderMaterial.setTexture('sampler_NormalMap', feetNormalTexture)

  // skin
  const skinTexture = new Texture('/skin-Normal', scene)
  skinShaderMaterial.setTexture('sampler_MainTex', skinTexture)

  try {
    // setup the mappings for all the contents
    setupMappings(config)

    // emote controller
    let emoteController: IEmoteController

    // create promises for both avatars
    const avatarPromises: Promise<void | Asset>[] = []

    if (config.type === PreviewType.AVATAR) {
      // get slots
      const slots = getSlots(config)

      // get wearables
      const wearables = Array.from(slots.values())

      for (const wearable of wearables.filter(isModel)) {
        // if (
        //   wearable?.data?.category !== 'lower_body' &&
        //   wearable?.data?.category !== 'hair' &&
        //   wearable?.data?.category !== 'upper_body'
        // ) {
        //   const promise = loadWearable(scene, wearable, config.bodyShape, config.skin, config.hair).catch((error) => {
        //     console.warn(error.message)
        //   })
        //   avatarPromises?.push(promise)
        // }
        const promise = loadWearable(scene, wearable, config.bodyShape, config.skin, config.hair).catch((error) => {
          console.warn(error.message)
        })
        avatarPromises?.push(promise)
      }

      const assets = (await Promise.all(avatarPromises)).filter(isSuccesful)

      // add all assets to  scene and create shaderMaterial based on bodyPart
      for (const asset of assets) {
        asset.container.addAllToScene()
      }

      for (const mesh of scene.meshes) {
        const name = mesh.name.toLowerCase()
        mesh.computeBonesUsingShaders = false
        if (name.endsWith('ubody_basemesh')) {
          mesh.setEnabled(false)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('lbody_basemesh')) {
          mesh.setEnabled(false)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('feet_basemesh')) {
          mesh.setEnabled(false)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('head')) {
          mesh.setEnabled(true)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('head_basemesh')) {
          mesh.setEnabled(true)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('mask_eyes')) {
          mesh.setEnabled(true)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('mask_eyebrows')) {
          mesh.setEnabled(true)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('mask_mouth')) {
          mesh.setEnabled(true)
          mesh.material = skinShaderMaterial
        }
        if (name.endsWith('hands_basemesh')) {
          mesh.setEnabled(true)
          mesh.material = skinShaderMaterial
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

    // options could be new-avatar, outline, both, old
    const renderMode: any = 'new-avatar'

    engine.runRenderLoop(() => {
      switch (renderMode) {
        case 'outline':
          outlineShaderMaterial.backFaceCulling = false
          outlineShaderMaterial.setColor4('_BaseColor', new Color4(1, 0.75, 0.8, 1))
          for (const mesh of scene.meshes) {
            if (meshIDsToOutline?.includes(mesh?.id)) {
              mesh.material = outlineShaderMaterial // Assign the outline shader material
            }
          }
          engine.clear(scene.clearColor, true, true)
          scene.render()
          break
        case 'new-avatar':
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
            mesh.computeBonesUsingShaders = false
          }
          scene.render()
          break
        case 'both':
          outlineShaderMaterial.backFaceCulling = false
          outlineShaderMaterial.setColor4('_BaseColor', new Color4(1, 0.75, 0.8, 1))
          for (const mesh of scene.meshes) {
            if (meshIDsToOutline?.includes(mesh?.id)) {
              mesh.material = outlineShaderMaterial // Assign the outline shader material
            }
          }
          engine.clear(scene.clearColor, true, true)
          scene.render()
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
            mesh.computeBonesUsingShaders = false
          }
          scene.render()
          break
        case 'old':
          scene.render()
          break
        default:
          console.warn(`Unknown render mode: ${renderMode}`)
          break
      }
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
