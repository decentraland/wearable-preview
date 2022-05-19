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
  Scene,
  SceneLoader,
  SpotLight,
  Texture,
  TextureAssetTask,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import { PreviewCamera, PreviewConfig, PreviewType, WearableBodyShape, WearableDefinition } from '@dcl/schemas'
import { isDev, isIOs } from '../env'
import { getRepresentation } from '../representation'
import { startAutoRotateBehavior } from './camera'

// needed for debugging
if (isDev) {
  require('@babylonjs/inspector')
}

export type Asset = {
  container: AssetContainer
  wearable: WearableDefinition
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
let engine: Engine
export async function createScene(canvas: HTMLCanvasElement, config: PreviewConfig) {
  // Create engine
  if (engine) {
    engine.dispose()
  }
  engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  })

  // Load GLB/GLTF
  const root = new Scene(engine)
  root.autoClear = true
  root.clearColor = new Color4(0, 0, 0, 0)
  root.ambientColor = new Color3(1, 1, 1)
  root.preventDefaultOnPointerDown = false

  // Setup Camera
  const camera = new ArcRotateCamera('camera', 0, 0, 0, new Vector3(0, 0, 0), root)
  camera.mode = Camera.PERSPECTIVE_CAMERA
  switch (config.camera) {
    case PreviewCamera.INTERACTIVE: {
      switch (config.type) {
        case PreviewType.WEARABLE: {
          startAutoRotateBehavior(camera, config)
          camera.position = new Vector3(-2, 2, 2)
          break
        }
        case PreviewType.AVATAR: {
          camera.position = new Vector3(0, 1, 3.5)
          break
        }
        default: {
          console.warn(`Unexpected preview.type="${config.type}"`)
          // do nothing
        }
      }
      camera.attachControl(canvas, true)
      break
    }
    case PreviewCamera.STATIC: {
      camera.position = new Vector3(0, 1, 3.5)
      break
    }
  }
  const offset = new Vector3(config.offsetX, config.offsetY, config.offsetZ)
  camera.position.addInPlace(offset)
  camera.setTarget(offset)

  // compute camera radius
  camera.lowerRadiusLimit = camera.radius / config.zoom
  camera.upperRadiusLimit = camera.lowerRadiusLimit * config.wheelZoom
  camera.radius = camera.lowerRadiusLimit + ((camera.upperRadiusLimit - camera.lowerRadiusLimit) * config.wheelStart) / 100
  camera.wheelPrecision = config.wheelPrecision

  // Setup lights
  if (config.type === PreviewType.WEARABLE) {
    const directional = new DirectionalLight('directional', new Vector3(0, 0, 1), root)
    directional.intensity = 1
    const spot = new SpotLight('spot', new Vector3(-2, 2, 2), new Vector3(2, -2, -2), Math.PI / 2, 1000, root)
    spot.intensity = 1
  }
  const top = new HemisphericLight('top', new Vector3(0, -1, 0), root)
  top.intensity = 1.0
  const bottom = new HemisphericLight('bottom', new Vector3(0, 1, 0), root)
  bottom.intensity = 1.0

  // Setup effects
  // Avoid ios since the glow effect breaks on safari: https://github.com/decentraland/wearable-preview/issues/11
  if (!isIOs()) {
    const glowLayer = new GlowLayer('glow', root)
    glowLayer.intensity = 0.4
  }

  // Render loop
  engine.runRenderLoop(() => {
    root.render()
  })

  // Dev tools
  if (isDev) {
    root.debugLayer.show({ showExplorer: true, embedMode: true })
  }

  return root
}

export async function loadMask(scene: Scene, wearable: WearableDefinition, bodyShape: WearableBodyShape): Promise<Texture | null> {
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

export async function loadTexture(scene: Scene, wearable: WearableDefinition, bodyShape: WearableBodyShape): Promise<Texture | null> {
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
 * Center and resizes a Scene to fit in the camera view
 * @param scene
 */

export function center(scene: Scene) {
  // Setup parent
  const parent = new Mesh('parent', scene)
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
