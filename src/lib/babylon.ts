import {
  ArcRotateCamera,
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
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import { GLTFFileLoader } from '@babylonjs/loaders'
import { WearableBodyShape, WearableCategory } from '@dcl/schemas'
import future from 'fp-future'
import { AvatarPreview } from './avatar'
import { getContentUrl, getRepresentation, hasRepresentation, isTexture } from './representation'
import { Wearable } from './wearable'

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
async function createScene(canvas: HTMLCanvasElement, zoom: number) {
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
  glow.intensity = 1

  // Setup Camera
  var camera = new ArcRotateCamera('camera', 0, 0, 0, new Vector3(0, 0, 0), root)
  camera.mode = Camera.PERSPECTIVE_CAMERA
  camera.position = new Vector3(-2, 2, 2)
  camera.useAutoRotationBehavior = true
  camera.autoRotationBehavior!.idleRotationSpeed = 0.2
  camera.setTarget(Vector3.Zero())
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius / zoom
  camera.attachControl(canvas, true)

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

/**
 * Loads a list of wearables into the Scene, using a given a body shape, skin and hair color
 * @param scene
 * @param wearable
 * @param bodyShape
 * @param skin
 * @param hair
 */

async function loadModel(scene: Scene, wearable: Wearable, bodyShape = WearableBodyShape.MALE, skin?: string, hair?: string) {
  const representation = getRepresentation(wearable, bodyShape)
  if (isTexture(representation)) {
    throw new Error(`The wearable="${wearable.id}" is a texture`)
  }
  const url = getContentUrl(representation)
  const modelFuture = future<Scene>()
  const loadScene = async (url: string, extension: string) => SceneLoader.AppendAsync(url, '', scene, null, extension)
  const getLoader = async (url: string) => {
    // try with GLB, if it fails try with GLTF
    try {
      return await loadScene(url, '.glb')
    } catch (error) {
      return await loadScene(url, '.gltf')
    }
  }
  const loader = await getLoader(url)
  loader.onReadyObservable.addOnce((scene) => modelFuture.resolve(scene))
  const model = await modelFuture

  // Clean up
  for (let material of model.materials) {
    if (material.name.toLowerCase().includes('hair_mat')) {
      if (hair) {
        const pbr = material as PBRMaterial
        pbr.albedoColor = Color3.FromHexString(hair)
      } else {
        material.alpha = 0
        scene.removeMaterial(material)
      }
    }
    if (material.name.toLowerCase().includes('avatarskin_mat')) {
      if (skin) {
        const pbr = material as PBRMaterial
        pbr.albedoColor = Color3.FromHexString(skin)
      } else {
        material.alpha = 0
        scene.removeMaterial(material)
      }
    }
  }

  if ((wearable.data.category as string) === 'body_shape') {
    for (const mesh of model.meshes) {
      if (mesh.name.endsWith('lBody_BaseMesh')) {
        mesh.setEnabled(false)
      }
      if (mesh.name.endsWith('uBody_BaseMesh')) {
        mesh.setEnabled(false)
      }
      if (mesh.name.endsWith('Feet_BaseMesh')) {
        mesh.setEnabled(false)
      }
    }
  }

  return [model, wearable] as const
}

/**
 * Center and resizes a Scene to fit in the camera view
 * @param scene
 */

function center(scene: Scene) {
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

function createMappings(wearables: Wearable[], bodyShape = WearableBodyShape.MALE) {
  const mappings: Record<string, string> = {}
  for (const wearable of wearables) {
    try {
      const representation = getRepresentation(wearable, bodyShape)
      for (const file of representation.contents) {
        mappings[file.key] = file.url
      }
    } catch (error) {
      console.warn(
        `Skipping generation of mappings for wearable="${wearable.id}" since it lacks a representation for bodyShape="${bodyShape}"`
      )
      continue
    }
  }
  return mappings
}

/**
 * Configures the mappings for all the relative paths within a model to the right IPFS in the catalyst
 * @param wearables
 */
function setupMappings(wearables: Wearable[], bodyShape = WearableBodyShape.MALE) {
  const mappings = createMappings(wearables, bodyShape)
  SceneLoader.OnPluginActivatedObservable.add((plugin) => {
    if (plugin.name === 'gltf') {
      const gltf = plugin as GLTFFileLoader
      gltf.preprocessUrlAsync = async (url: string) => {
        const baseUrl = `/content/contents/`
        const parts = url.split(baseUrl)
        return parts.length > 0 && !!parts[1] ? mappings[parts[1]] : url
      }
    }
  })
}

function isResult(result: void | readonly [Scene, Wearable]): result is readonly [Scene, Wearable] {
  return !!result
}

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */
export async function render(canvas: HTMLCanvasElement, avatar: AvatarPreview) {
  // create the root scene
  const root = await createScene(canvas, avatar.zoom)

  // setup the mappings for all the contents
  setupMappings(avatar.wearables, avatar.bodyShape)

  // assemly wearables
  const catalog = new Map<WearableCategory, Wearable>()
  for (const wearable of avatar.wearables) {
    const slot = wearable.data.category
    if (hasRepresentation(wearable, avatar.bodyShape)) {
      catalog.set(slot, wearable)
    }
  }
  for (const wearable of catalog.values()) {
    const hidden = wearable.data.hides || []
    for (const slot of hidden) {
      catalog.delete(slot)
    }
  }

  // load all the wearables into the root scene
  const promises: Promise<void | readonly [Scene, Wearable]>[] = []
  for (const wearable of catalog.values()) {
    const promise = loadModel(root, wearable, avatar.bodyShape, avatar.skin, avatar.hair).catch((error) => {
      console.warn(error.message)
    })
    promises.push(promise)
  }

  const results = await Promise.all(promises)
  for (const [model, wearable] of results.filter(isResult)) {
    console.log(model, wearable)
  }

  // center the root scene into the camera
  center(root)
}
