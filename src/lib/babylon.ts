import {
  ArcRotateCamera,
  BoundingInfo,
  Camera,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  Scene,
  SceneLoader,
  SpotLight,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders'
import { GLTFFileLoader } from '@babylonjs/loaders'
import future from 'fp-future'
import { Env } from '../types/env'
import { peerByEnv } from './api/peer'

const hideMaterialList = ['hair_mat', 'avatarskin_mat']

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

export async function loadWearable(canvas: HTMLCanvasElement, url: string, mappings: Record<string, string>, env: Env) {
  // Create engine
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  })

  // Load GLTF
  const root = new Scene(engine)
  root.autoClear = true
  root.clearColor = new Color4(0, 0, 0, 0) //Color3.FromHexString(Rarity.getColor(Rarity.UNIQUE)).toColor4()
  root.preventDefaultOnPointerDown = false
  const sceneFuture = future<Scene>()
  const sceneResolver = (scene: Scene) => scene.onReadyObservable.addOnce(() => sceneFuture.resolve(scene))
  SceneLoader.OnPluginActivatedObservable.addOnce((plugin) => {
    if (plugin.name === 'gltf') {
      const gltf = plugin as GLTFFileLoader
      gltf.preprocessUrlAsync = async (url: string) => {
        const baseUrl = `${peerByEnv[env]}/content/contents/`
        const parts = url.split(baseUrl)
        return parts.length > 0 && !!parts[1] ? mappings[parts[1]] : url
      }
    }
  })
  SceneLoader.Append(url, '', root, sceneResolver, null, null, '.glb')
  const scene = await sceneFuture

  // effects
  var glow = new GlowLayer('glow', scene, {
    mainTextureFixedSize: 1024,
    blurKernelSize: 64,
  })
  glow.intensity = 1

  // Setup Camera
  var camera = new ArcRotateCamera('camera', 0, 0, 0, new Vector3(0, 0, 0), scene)
  camera.mode = Camera.PERSPECTIVE_CAMERA
  camera.position = new Vector3(-2, 2, 2)
  camera.useAutoRotationBehavior = true
  camera.setTarget(Vector3.Zero())
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius
  camera.attachControl(canvas, true)

  // Setup lights
  var directional = new DirectionalLight('directional', new Vector3(0, 0, 1), scene)
  directional.intensity = 1
  var top = new HemisphericLight('top', new Vector3(0, -1, 0), scene)
  top.intensity = 1
  var bottom = new HemisphericLight('bottom', new Vector3(0, 1, 0), scene)
  bottom.intensity = 1
  var spot = new SpotLight('spot', new Vector3(-2, 2, 2), new Vector3(2, -2, -2), Math.PI / 2, 1000, scene)
  spot.intensity = 1

  // Setup parent
  var parent = new Mesh('parent', scene)
  for (const mesh of scene.meshes) {
    if (mesh !== parent) {
      mesh.setParent(parent)
    }
  }

  // Clean up
  for (const materialName of hideMaterialList) {
    for (let material of scene.materials) {
      if (material.name.toLowerCase().includes(materialName)) {
        material.alpha = 0
        scene.removeMaterial(material)
      }
    }
    for (let texture of scene.textures) {
      if (texture.name.toLowerCase().includes(materialName)) {
        texture.dispose()
        scene.removeTexture(texture)
      }
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

  // render loop
  engine.runRenderLoop(() => scene.render())
}
