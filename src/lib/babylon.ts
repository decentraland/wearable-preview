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
import { WearableCategory } from '@dcl/schemas'
import future from 'fp-future'

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

function getZoomForCategory(category: WearableCategory) {
  switch (category) {
    case WearableCategory.UPPER_BODY:
      return 2
    case WearableCategory.SKIN:
      return 1.75
    default:
      return 1.25
  }
}

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

async function load(scene: Scene, url: string, skin?: string, hair?: string) {
  const wearableFuture = future<Scene>()
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
  loader.onReadyObservable.addOnce((scene) => wearableFuture.resolve(scene))
  const wearable = await wearableFuture

  // Clean up
  for (let material of wearable.materials) {
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
}

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

export async function preview(
  canvas: HTMLCanvasElement,
  url: string,
  mappings: Record<string, string>,
  options: { category: WearableCategory; skin?: string; hair?: string }
) {
  const zoom = getZoomForCategory(options.category)
  const root = await createScene(canvas, zoom)

  SceneLoader.OnPluginActivatedObservable.addOnce((plugin) => {
    if (plugin.name === 'gltf') {
      const gltf = plugin as GLTFFileLoader
      gltf.preprocessUrlAsync = async (url: string) => {
        const baseUrl = `/content/contents/`
        const parts = url.split(baseUrl)
        return parts.length > 0 && !!parts[1] ? mappings[parts[1]] : url
      }
    }
  })

  await load(root, url, options.skin, options.hair)

  center(root)
}
