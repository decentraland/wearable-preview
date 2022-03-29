import {
  ArcRotateCamera,
  AssetContainer,
  BoundingInfo,
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  PBRMaterial,
  Scene,
  SceneLoader,
  SpotLight,
  Texture,
  TextureAssetTask,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import { WearableBodyShape } from '@dcl/schemas'
import { AvatarCamera, AvatarPreview, AvatarPreviewType } from '../avatar'
import { getContentUrl, getRepresentation, isTexture } from '../representation'
import { Wearable } from '../wearable'
import { startAutoRotateBehavior } from './camera'

export type Asset = {
  container: AssetContainer
  wearable: Wearable
}

/**
 * It refreshes the bounding info of a mesh, taking into account all of its children
 * @param parent
 */
function refreshBoundingInfo(parent: Mesh) {
  const children = parent.getChildren().filter((mesh) => mesh.id !== '__root__')
  if (children.length > 0) {
    const child = children[0] as Mesh
    // child.showBoundingBox = true
    let boundingInfo = child.getBoundingInfo()

    let min = boundingInfo.boundingBox.minimumWorld.add(child.position)
    let max = boundingInfo.boundingBox.maximumWorld.add(child.position)

    for (let i = 1; i < children.length; i++) {
      const child = children[i] as Mesh
      // child.showBoundingBox = true
      boundingInfo = child.getBoundingInfo()
      const siblingMin = boundingInfo.boundingBox.minimumWorld.add(child.position)
      const siblingMax = boundingInfo.boundingBox.maximumWorld.add(child.position)

      min = Vector3.Minimize(min, siblingMin)
      max = Vector3.Maximize(max, siblingMax)
    }

    parent.setBoundingInfo(new BoundingInfo(min, max))
  }
}

/**
 * Creates a Scene with the right camera, light and effects
 * @param canvas
 * @param zoom
 * @returns
 */
export async function createScene(canvas: HTMLCanvasElement, preview: AvatarPreview) {
  // Create engine
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  })

  // Load GLB/GLTF
  const root = new Scene(engine)
  root.autoClear = true
  root.clearColor = new Color4(0, 0, 0, 0)
  root.preventDefaultOnPointerDown = false

  // effects
  var glow = new GlowLayer('glow', root, {
    mainTextureFixedSize: 1024,
    blurKernelSize: 64,
  })
  glow.intensity = 0.2

  // Setup Camera
  var camera = new ArcRotateCamera('camera', 0, 0, 0, new Vector3(0, 0, 0), root)
  camera.mode = Camera.PERSPECTIVE_CAMERA
  switch (preview.camera) {
    case AvatarCamera.INTERACTIVE: {
      switch (preview.type) {
        case AvatarPreviewType.WEARABLE: {
          startAutoRotateBehavior(camera, preview)
          camera.position = new Vector3(-2, 2, 2)
          break
        }
        case AvatarPreviewType.AVATAR: {
          camera.position = new Vector3(0, 1, 3.5)
          break
        }
        default: {
          console.warn(`Unexpected preview.type="${preview.type}"`)
          // do nothing
        }
      }
      camera.attachControl(canvas, true)
      break
    }
    case AvatarCamera.STATIC: {
      camera.position = new Vector3(0, 1, 3.5)
      break
    }
  }
  const offset = new Vector3(preview.offsetX, preview.offsetY, preview.offsetZ)
  camera.position.addInPlace(offset)
  camera.setTarget(offset)
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius / preview.zoom

  // Setup lights
  var directional = new DirectionalLight('directional', new Vector3(0, 0, 1), root)
  directional.intensity = 1
  var top = new HemisphericLight('top', new Vector3(0, -1, 0), root)
  top.intensity = 1
  var bottom = new HemisphericLight('bottom', new Vector3(0, 1, 0), root)
  bottom.intensity = 1
  var spot = new SpotLight('spot', new Vector3(-2, 2, 2), new Vector3(2, -2, -2), Math.PI / 2, 1000, root)
  spot.intensity = 1

  // render loop
  engine.runRenderLoop(() => root.render())

  return root
}

export async function loadMask(scene: Scene, wearable: Wearable, bodyShape: WearableBodyShape): Promise<Texture | null> {
  const name = wearable.id
  const representation = getRepresentation(wearable, bodyShape)
  const file = representation.contents.find((file) => file.key.toLowerCase().endsWith('_mask.png'))
  if (file) {
    return new Promise((resolve, reject) => {
      const task = new TextureAssetTask(name, file.url, true, false)
      task.onError = () => reject(task.errorObject)
      task.onSuccess = () => {
        resolve(task.texture)
      }
      task.run(scene, () => resolve(task.texture), reject)
    })
  }
  return null
}

export async function loadTexture(scene: Scene, wearable: Wearable, bodyShape: WearableBodyShape): Promise<Texture | null> {
  const name = wearable.id
  const representation = getRepresentation(wearable, bodyShape)
  const file = representation.contents.find(
    (file) => file.key.toLowerCase().endsWith('.png') && !file.key.toLowerCase().endsWith('_mask.png')
  )
  if (file) {
    return new Promise((resolve, reject) => {
      const task = new TextureAssetTask(name, file.url, true, false)
      task.onError = () => reject(task.errorObject)
      task.onSuccess = () => {
        resolve(task.texture)
      }
      task.run(scene, () => resolve(task.texture), reject)
    })
  }
  return null
}

export async function loadAssetContainer(scene: Scene, url: string) {
  const load = async (url: string, extension: string) => SceneLoader.LoadAssetContainerAsync(url, '', scene, null, extension)
  // try with GLB, if it fails try with GLTF
  try {
    return await load(url, '.glb')
  } catch (error) {
    return await load(url, '.gltf')
  }
}

/**
 * Loads a wearable into the Scene, using a given a body shape, skin and hair color
 * @param scene
 * @param wearable
 * @param bodyShape
 * @param skin
 * @param hair
 */

const hairMaterials = ['hair_mat']
// there are some representations that use a modified material name like "skin-f" or "skin_f", i added them to the list support those wearables
const skinMaterials = ['avatarskin_mat', 'skin-f', 'skin_f']
export async function loadWearable(scene: Scene, wearable: Wearable, bodyShape = WearableBodyShape.MALE, skin?: string, hair?: string) {
  const representation = getRepresentation(wearable, bodyShape)
  if (isTexture(representation)) {
    throw new Error(`The wearable="${wearable.id}" is a texture`)
  }
  const url = getContentUrl(representation)
  const container = await loadAssetContainer(scene, url)

  // Clean up
  for (let material of container.materials) {
    if (hairMaterials.some((mat) => material.name.toLowerCase().includes(mat))) {
      if (hair) {
        const pbr = material as PBRMaterial
        pbr.albedoColor = Color3.FromHexString(hair)
      } else {
        material.alpha = 0
        scene.removeMaterial(material)
      }
    }
    if (skinMaterials.some((mat) => material.name.toLowerCase().includes(mat))) {
      if (skin) {
        const pbr = material as PBRMaterial
        pbr.albedoColor = Color3.FromHexString(skin)
      } else {
        material.alpha = 0
        scene.removeMaterial(material)
      }
    }
  }

  // Stop any animations
  for (const animationGroup of container.animationGroups) {
    animationGroup.stop()
    animationGroup.reset()
    animationGroup.dispose()
  }

  return { container, wearable }
}

/**
 * Center and resizes a Scene to fit in the camera view
 * @param scene
 */

export function center(scene: Scene) {
  // Setup parent
  var parent = new Mesh('parent', scene)
  for (const mesh of scene.meshes) {
    if (mesh !== parent) {
      mesh.setParent(parent)
    }
  }

  // resize and center
  refreshBoundingInfo(parent)
  const bounds = parent.getBoundingInfo().boundingBox.extendSize
  const size = bounds.length()
  const scale = new Vector3(1 / size, 1 / size, 1 / size)
  parent.scaling = scale
  const center = parent.getBoundingInfo().boundingBox.center.multiply(scale)
  parent.position.subtractInPlace(center)
}
