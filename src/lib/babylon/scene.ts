import {
  ArcRotateCamera,
  AssetContainer,
  Axis,
  BinaryFileAssetTask,
  BoundingInfo,
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  Sound,
  SpotLight,
  StandardMaterial,
  Texture,
  TextureAssetTask,
  Vector3,
} from '@babylonjs/core'
import { AdvancedDynamicTexture, Rectangle } from '@babylonjs/gui'
import '@babylonjs/loaders'
import { GridMaterial } from '@babylonjs/materials'
import {
  BodyShape,
  EmoteRepresentationDefinition,
  ISceneController,
  PreviewCamera,
  PreviewConfig,
  PreviewProjection,
  PreviewType,
  WearableDefinition,
} from '@dcl/schemas'
import { hexToColor } from '../color'
import { isIOs } from '../env'
import { getWearableRepresentation } from '../representation'
import { createSceneController } from '../scene'
import { startAutoRotateBehavior } from './camera'

// needed for debugging
const showInspector = process.env.REACT_APP_DEBUG
if (showInspector) {
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
export async function createScene(
  canvas: HTMLCanvasElement,
  config: PreviewConfig
): Promise<[Scene, ISceneController]> {
  // Create engine
  if (engine) {
    engine.dispose()
  }
  engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  })

  // Setup scene
  const root = new Scene(engine)
  root.autoClear = true
  root.clearColor = config.background.transparent
    ? new Color4(0, 0, 0, 0)
    : hexToColor(config.background.color).toColor4()
  root.ambientColor = new Color3(1, 1, 1)
  root.preventDefaultOnPointerDown = false

  if (config.showSceneBoundaries) {
    // create transparent cylinder to show the boundaries
    const ground = MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, root)
    const underground = MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, root)
    underground.rotate(Axis.Z, Math.PI)
    underground.position.y = -0.05 // to avoid cylinder and avatar clipping
    const groundMaterial = new GridMaterial('groundMaterial', root)
    groundMaterial.mainColor = new Color3(1, 1, 1)
    groundMaterial.lineColor = new Color3(0, 0, 0)
    groundMaterial.majorUnitFrequency = 0
    ground.material = groundMaterial
    underground.material = groundMaterial

    const cylinder = MeshBuilder.CreateCylinder('boundaries', { diameter: 2, height: 3 })
    const cylinderMaterial = new StandardMaterial('boundariesMaterial', root)
    cylinderMaterial.alpha = 0.3
    cylinderMaterial.diffuseColor = new Color3(1, 45 / 255, 85 / 255)
    cylinder.material = cylinderMaterial
    cylinder.position.y = 1.51 // to avoid clipping with the floor
  }

  if (config.showThumbnailBoundaries) {
    const frameTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI')
    const thumbnailBoundaries = new Rectangle()
    thumbnailBoundaries.width = 0.5
    thumbnailBoundaries.height = 1
    thumbnailBoundaries.color = '#736E7D'
    thumbnailBoundaries.thickness = 2
    frameTexture.addControl(thumbnailBoundaries)
  }

  // Setup Camera
  const camera = new ArcRotateCamera('camera', 0, 0, 0, new Vector3(0, 0, 0), root)
  camera.position = new Vector3(config.cameraX, config.cameraY, config.cameraZ)
  camera.minZ = 0.1

  switch (config.projection) {
    case PreviewProjection.PERSPECTIVE: {
      camera.mode = Camera.PERSPECTIVE_CAMERA
      break
    }
    case PreviewProjection.ORTHOGRAPHIC: {
      camera.mode = Camera.ORTHOGRAPHIC_CAMERA
      camera.orthoTop = 1
      camera.orthoBottom = -1
      camera.orthoLeft = -1
      camera.orthoRight = 1
      break
    }
  }

  if (config.type === PreviewType.WEARABLE) {
    startAutoRotateBehavior(camera, config)
  }

  if (config.camera === PreviewCamera.INTERACTIVE) {
    camera.attachControl(canvas, true)
  }

  const offset = new Vector3(config.offsetX, config.offsetY, config.offsetZ)
  camera.position.addInPlace(offset)
  camera.setTarget(offset)

  // compute camera radius
  camera.lowerRadiusLimit = camera.radius / config.zoom
  camera.upperRadiusLimit = camera.lowerRadiusLimit * config.wheelZoom
  camera.radius =
    camera.lowerRadiusLimit + ((camera.upperRadiusLimit - camera.lowerRadiusLimit) * config.wheelStart) / 100
  camera.wheelPrecision = config.wheelPrecision

  // Disable panning by setting the sensibility to 0
  if (!config.panning) {
    camera.panningSensibility = 0
  }

  // Set the lower and upper beta bounds to the current beta to avoid the camera to move up and down
  if (config.lockBeta) {
    camera.lowerBetaLimit = camera.beta
    camera.upperBetaLimit = camera.beta
  }

  // Set the lower and upper alpha bounds to the current alpha to avoid the camera to move left and right
  if (config.lockAlpha) {
    camera.lowerAlphaLimit = camera.alpha
    camera.upperAlphaLimit = camera.alpha
  }

  // Set the lower and upper radius bounds to the current radius to avoid the camera to zoom in and out
  if (config.lockRadius) {
    camera.lowerRadiusLimit = camera.radius
    camera.upperRadiusLimit = camera.radius
  }

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
    glowLayer.intensity = 2.0
  }

  // Render loop
  engine.runRenderLoop(() => {
    root.render()
  })

  // Dev tools
  if (showInspector) {
    root.debugLayer.show({ showExplorer: true, embedMode: true })
  }

  return [root, createSceneController(engine, root, camera)]
}

export async function loadMask(
  scene: Scene,
  wearable: WearableDefinition,
  bodyShape: BodyShape
): Promise<Texture | null> {
  const name = wearable.id
  const representation = getWearableRepresentation(wearable, bodyShape)
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

export async function loadTexture(
  scene: Scene,
  wearable: WearableDefinition,
  bodyShape: BodyShape
): Promise<Texture | null> {
  const name = wearable.id
  const representation = getWearableRepresentation(wearable, bodyShape)
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

export function loadSound(scene: Scene, representation: EmoteRepresentationDefinition): Promise<Sound | null> {
  return new Promise((resolve, reject) => {
    const soundUrl = representation.contents.find(
      (content) => content.key.toLowerCase().endsWith('.mp3') || content.key.toLowerCase().endsWith('ogg')
    )?.url

    if (!soundUrl) {
      return resolve(null)
    }

    const task = new BinaryFileAssetTask('Sound task', soundUrl)
    const onSuccess = () =>
      resolve(
        new Sound('music', task.data, scene, null, {
          spatialSound: true,
        })
      )
    const onError = (message?: string) => reject(message)
    task.run(scene, onSuccess, onError)
  })
}

export async function loadAssetContainer(scene: Scene, url: string) {
  const load = async (url: string, extension: string) =>
    SceneLoader.LoadAssetContainerAsync(url, '', scene, null, extension)
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
