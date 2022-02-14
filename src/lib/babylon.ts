import {
  AbstractMesh,
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
  Orientation,
  PBRMaterial,
  Scene,
  SceneLoader,
  SpotLight,
  StandardMaterial,
  Texture,
  TextureAssetTask,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import { GLTFFileLoader } from '@babylonjs/loaders'
import { WearableBodyShape, WearableCategory } from '@dcl/schemas'
import { AvatarPreview, AvatarPreviewType } from './avatar'
import { hexToColor } from './color'
import { getContentUrl, getRepresentation, getRepresentationOrDefault, hasRepresentation, isTexture } from './representation'
import { Wearable } from './wearable'

type Asset = {
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
  glow.intensity = 0.2

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

async function loadMask(scene: Scene, wearable: Wearable, bodyShape: WearableBodyShape): Promise<Texture | null> {
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

async function loadTexture(scene: Scene, wearable: Wearable, bodyShape: WearableBodyShape): Promise<Texture | null> {
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

/**
 * Loads a wearable into the Scene, using a given a body shape, skin and hair color
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
  const loadAssetContainer = async (url: string) => {
    const load = async (url: string, extension: string) => SceneLoader.LoadAssetContainerAsync(url, '', scene, null, extension)
    // try with GLB, if it fails try with GLTF
    try {
      return await load(url, '.glb')
    } catch (error) {
      return await load(url, '.gltf')
    }
  }
  const container = await loadAssetContainer(url)

  // Clean up
  for (let material of container.materials) {
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

  return { container, wearable }
}

function isCategory(category: WearableCategory) {
  return (wearable: Wearable) => wearable.data.category === category
}

function isHidden(category: WearableCategory) {
  return (asset: Asset) => {
    return asset.wearable.data.category === category || (asset.wearable.data.hides || []).includes(category)
  }
}

function getBodyShape(assets: Asset[]) {
  const bodyShape = assets.find((part) => part.wearable.data.category === ('body_shape' as WearableCategory))

  if (!bodyShape) {
    throw new Error(`Could not find a bodyShape when trying to hide base body parts`)
  }

  // hide base body parts if necessary
  const hasSkin = assets.some((part) => part.wearable.data.category === WearableCategory.SKIN)
  const hideUpperBody = hasSkin || assets.some(isHidden(WearableCategory.UPPER_BODY))
  const hideLowerBody = hasSkin || assets.some(isHidden(WearableCategory.LOWER_BODY))
  const hideFeet = hasSkin || assets.some(isHidden(WearableCategory.FEET))
  const hideHead = hasSkin || assets.some(isHidden('head' as WearableCategory))

  for (const mesh of bodyShape.container.meshes) {
    const name = mesh.name.toLowerCase()
    if (name.endsWith('ubody_basemesh') && hideUpperBody) {
      console.log('hide upper', mesh, bodyShape.container, mesh.parent)
      mesh.setEnabled(false)
    }
    if (name.endsWith('lbody_basemesh') && hideLowerBody) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('feet_basemesh') && hideFeet) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('head') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('head_basemesh') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('mask_eyes') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('mask_eyebrows') && hideHead) {
      mesh.setEnabled(false)
    }
    if (name.endsWith('mask_mouth') && hideHead) {
      mesh.setEnabled(false)
    }
  }

  return bodyShape
}

function getCategoryLoader(scene: Scene, features: Wearable[], bodyShape: WearableBodyShape) {
  return async (category: WearableCategory) => {
    const feature = features.find(isCategory(category))
    if (feature) {
      return Promise.all([loadTexture(scene, feature, bodyShape), loadMask(scene, feature, bodyShape)]) as Promise<
        [Texture | null, Texture | null]
      >
    }
    return [null, null] as [null, null]
  }
}

async function getFacialFeatures(scene: Scene, features: Wearable[], bodyShape: WearableBodyShape) {
  const loadCategory = getCategoryLoader(scene, features, bodyShape)
  const [eyes, eyebrows, mouth] = await Promise.all([
    loadCategory(WearableCategory.EYES),
    loadCategory(WearableCategory.EYEBROWS),
    loadCategory(WearableCategory.MOUTH),
  ])
  return { eyes, eyebrows, mouth }
}

async function applyFacialFeatures(
  scene: Scene,
  bodyShape: Asset,
  eyes: [Texture | null, Texture | null],
  eyebrows: [Texture | null, Texture | null],
  mouth: [Texture | null, Texture | null],
  preview: AvatarPreview
) {
  for (const mesh of bodyShape.container.meshes) {
    if (mesh.name.toLowerCase().endsWith('mask_eyes')) {
      const [texture, mask] = eyes
      if (texture) {
        applyTextureAndMask(scene, 'eyes', mesh, texture, preview.eyes, mask, '#ffffff')
      }
    }
    if (mesh.name.toLowerCase().endsWith('mask_eyebrows')) {
      const [texture, mask] = eyebrows
      if (texture) {
        applyTextureAndMask(scene, 'eyebrows', mesh, texture, preview.hair, mask, preview.hair)
      }
    }
    if (mesh.name.toLowerCase().endsWith('mask_mouth')) {
      const [texture, mask] = mouth
      if (texture) {
        applyTextureAndMask(scene, 'mouth', mesh, texture, preview.skin, mask, preview.skin)
      }
    }
  }
}

function applyTextureAndMask(
  scene: Scene,
  name: string,
  mesh: AbstractMesh,
  texture: Texture,
  color: string,
  mask: Texture | null,
  maskColor: string
) {
  const newMaterial = new StandardMaterial(`${name}_standard_material`, scene)
  newMaterial.alphaMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
  newMaterial.backFaceCulling = true
  texture.hasAlpha = true
  newMaterial.sideOrientation = Orientation.CW
  newMaterial.diffuseTexture = texture
  newMaterial.diffuseColor = mask ? Color3.Black() : hexToColor(maskColor)
  if (mask) {
    newMaterial.emissiveTexture = mask
    newMaterial.emissiveColor = hexToColor(color)
  }
  mesh.material = newMaterial
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

function isSuccesful(result: void | Asset): result is Asset {
  return !!result
}

function isModel(wearable: Wearable): boolean {
  const representation = getRepresentationOrDefault(wearable)
  return !isTexture(representation)
}

function isFacialFeature(wearable: Wearable): boolean {
  return !isModel(wearable)
}

/**
 * Initializes Babylon, creates the scene and loads a list of wearables in it
 * @param canvas
 * @param wearables
 * @param options
 */
export async function render(canvas: HTMLCanvasElement, preview: AvatarPreview) {
  // create the root scene
  const root = await createScene(canvas, preview.zoom)

  // setup the mappings for all the contents
  setupMappings(preview.wearables, preview.bodyShape)

  // assembly wearables
  const catalog = new Map<WearableCategory, Wearable>()
  for (const wearable of preview.wearables) {
    const slot = wearable.data.category
    if (hasRepresentation(wearable, preview.bodyShape)) {
      catalog.set(slot, wearable)
    }
  }
  let hasSkin = false
  for (const wearable of catalog.values()) {
    const hidden = wearable.data.hides || []
    for (const slot of hidden) {
      catalog.delete(slot)
    }
    if (wearable.data.category === WearableCategory.SKIN) {
      hasSkin = true
    }
  }
  if (hasSkin) {
    catalog.delete(WearableCategory.HAIR)
    catalog.delete(WearableCategory.FACIAL_HAIR)
    catalog.delete(WearableCategory.MOUTH)
    catalog.delete(WearableCategory.EYEBROWS)
    catalog.delete(WearableCategory.EYES)
    catalog.delete(WearableCategory.UPPER_BODY)
    catalog.delete(WearableCategory.LOWER_BODY)
    catalog.delete(WearableCategory.FEET)
  }

  // load all the wearables into the root scene
  const promises: Promise<void | Asset>[] = []
  const wearables = Array.from(catalog.values())
  for (const wearable of wearables.filter(isModel)) {
    const promise = loadModel(root, wearable, preview.bodyShape, preview.skin, preview.hair).catch((error) => {
      console.warn(error.message)
    })
    promises.push(promise)
  }
  const assets = (await Promise.all(promises)).filter(isSuccesful)

  if (preview.type === AvatarPreviewType.AVATAR) {
    // build avatar
    const bodyShape = getBodyShape(assets)
    const features = wearables.filter(isFacialFeature)
    const { eyes, eyebrows, mouth } = await getFacialFeatures(root, features, preview.bodyShape)
    applyFacialFeatures(root, bodyShape, eyes, eyebrows, mouth, preview)
  }

  // add all assets to scene
  for (const asset of assets) {
    asset.container.addAllToScene()
  }

  // center the root scene into the camera
  center(root)
}
