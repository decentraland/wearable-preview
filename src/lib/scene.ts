import { Camera, Engine, Scene, Tools } from '@babylonjs/core'
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

export function createSceneController(engine: Engine, scene: Scene, camera: Camera): ISceneController {
  async function getScreenshot(width: number, height: number) {
    return Tools.CreateScreenshotUsingRenderTargetAsync(engine, camera, { width, height }, undefined, undefined, true)
  }

  function getMetrics() {
    const triangles = scene.meshes.reduce((total, mesh) => {
      return total + Math.floor(mesh.getTotalIndices() / 3)
    }, 0)
    const materials = scene.materials.length
    const meshes = scene.meshes.length
    const textures = scene.textures.filter(
      (texture) => texture.name && !ignoreTextureList.includes(texture.name)
    ).length

    return {
      triangles,
      materials,
      meshes,
      textures,
    }
  }

  return {
    getScreenshot,
    getMetrics,
  }
}
