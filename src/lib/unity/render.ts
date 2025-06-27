import { IPreviewController } from '@dcl/schemas'
import { loadUnityInstance } from './loader'
import { createSceneController } from './scene'
import { createEmoteController } from './emote'

export interface UnityInstance {
  SendMessage: (objectName: string, methodName: string, value: string) => void
  Quit?: () => void
  SetFullscreen?: (fullscreen: boolean) => void
  Module?: {
    canvas: HTMLCanvasElement
    SetFullscreen: (fullscreen: boolean) => void
  }
}

/**
 * Initializes Unity and creates the scene with the given configuration
 * @param canvas The canvas element where Unity will render
 * @param config The preview configuration
 */
export async function render(canvas: HTMLCanvasElement): Promise<IPreviewController & { unity: UnityInstance }> {
  let instance: UnityInstance | null = null

  try {
    // Initialize Unity instance
    instance = (await loadUnityInstance(
      canvas,
      '/unity/Build/aang-renderer.loader.js',
      '/unity/Build/aang-renderer.data.br',
      '/unity/Build/aang-renderer.framework.js.br',
      '/unity/Build/aang-renderer.wasm.br',
      '/unity/Build/aang-renderer.symbols.json.br',
      '/emotes',
      'Decentraland',
      'AangRenderer',
      '0.1.0',
      true,
      [],
    )) as UnityInstance

    if (!instance) {
      throw new Error('Failed to load Unity instance')
    }

    const sceneController = createSceneController(instance)
    const emoteController = createEmoteController(instance)

    return {
      scene: sceneController,
      emote: emoteController,
      unity: instance,
    }
  } catch (error) {
    console.error('Unity render failed:', error)
    if (instance?.Quit) {
      try {
        instance.Quit()
      } catch (e) {
        console.error('Error quitting Unity instance:', e)
      }
    }
    throw error
  }
}
