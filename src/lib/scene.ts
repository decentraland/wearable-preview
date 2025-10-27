import { ArcRotateCamera, Engine, Scene, Tools } from '@babylonjs/core'
import { ISceneController } from '@dcl/schemas'

// These are textures created by the preview itself so we don't count them
const ignoreTextureList = [
  // Ambient color
  'data:EnvironmentBRDFTexture0',
  // Glow layer
  'GlowLayerBlurRTT',
  'GlowLayerBlurRTT2',
  'HighlightLayerMainRTT',
]

export function createSceneController(engine: Engine, scene: Scene, camera: ArcRotateCamera): ISceneController {
  async function getScreenshot(width: number, height: number) {
    return Tools.CreateScreenshotUsingRenderTargetAsync(engine, camera, { width, height }, undefined, undefined, true)
  }

  async function changeZoom(delta: number) {
    camera.inertialRadiusOffset = camera.inertialRadiusOffset + delta
  }

  async function panCamera(offset: { x?: number; y?: number; z?: number }) {
    const { x, y, z } = offset
    camera.target.x = x || 0
    camera.target.y = y || 0
    camera.target.z = z || 0
  }

  async function changeCameraPosition(position: { alpha?: number; beta?: number; radius?: number }) {
    const { alpha, beta, radius } = position
    if (alpha) {
      camera.alpha = camera.alpha + alpha
    }
    if (beta) {
      camera.beta = camera.beta + beta
    }
    if (radius) {
      camera.radius = camera.radius + radius
    }
  }

  async function getMetrics() {
    const triangles = scene.meshes
      .filter((mesh) => !mesh.name.toLowerCase().includes('collider')) // remove colliders from metrics
      .reduce((total, mesh) => {
        return total + Math.floor(mesh.getTotalIndices() / 3)
      }, 0)
    const materials = scene.materials.length
    const meshes = scene.meshes.length
    const textures = scene.textures.filter(
      (texture) => texture.name && !ignoreTextureList.includes(texture.name),
    ).length

    return {
      triangles,
      materials,
      meshes,
      textures,
      bodies: meshes,
      entities: 1,
    }
  }

  async function setUsername(username: string) {
    // noop
    return
  }

  async function cleanup() {
    // noop
    return
  }

  return {
    getScreenshot,
    getMetrics,
    panCamera,
    changeZoom,
    changeCameraPosition,
    cleanup,
    setUsername,
  }
}
