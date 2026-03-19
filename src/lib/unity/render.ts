import { EmoteDefinition, IPreviewController } from '@dcl/schemas'
import { SocialEmoteAnimation } from '@dcl/schemas/dist/dapps/preview/social-emote-animation'
import { loadUnityInstance } from './loader'
import { createSceneController } from './scene'
import { createEmoteController } from './emote'
import { captureException } from '../sentry'
import { createPhysicsController } from './physics'

export interface UnityInstance {
  SendMessage: (objectName: string, methodName: string, value: string) => void
  Quit?: () => void
  SetFullscreen?: (fullscreen: boolean) => void
  Module?: {
    canvas: HTMLCanvasElement
    SetFullscreen: (fullscreen: boolean) => void
  }
}

type AangBuildConfig = {
  dataUrl: string
  frameworkUrl: string
  codeUrl: string
  symbolUrl: string
}

const COMPRESSED_AANG_BUILD: AangBuildConfig = {
  dataUrl: '/unity/Build/aang-renderer.data.br',
  frameworkUrl: '/unity/Build/aang-renderer.framework.js.br',
  codeUrl: '/unity/Build/aang-renderer.wasm.br',
  symbolUrl: '/unity/Build/aang-renderer.symbols.json.br',
}

const UNCOMPRESSED_AANG_BUILD: AangBuildConfig = {
  dataUrl: '/unity/Build/aang-renderer.data',
  frameworkUrl: '/unity/Build/aang-renderer.framework.js',
  codeUrl: '/unity/Build/aang-renderer.wasm',
  symbolUrl: '/unity/Build/aang-renderer.symbols.json',
}

function getAangBuildConfig(): AangBuildConfig {
  if (process.env.NODE_ENV !== 'production' && import.meta.env.VITE_AANG_USE_UNCOMPRESSED === 'true') {
    console.log('[UNITY] Using uncompressed Aang build')
    return UNCOMPRESSED_AANG_BUILD
  }

  return COMPRESSED_AANG_BUILD
}

/**
 * Initializes Unity and creates the scene with the given configuration
 * @param canvas The canvas element where Unity will render
 * @param emote The emote definition being previewed (if any)
 * @param socialEmote The selected social emote animation (if any)
 */
export async function render(
  canvas: HTMLCanvasElement,
  emote: EmoteDefinition | null,
  socialEmote?: SocialEmoteAnimation,
): Promise<IPreviewController & { unity: UnityInstance }> {
  let instance: UnityInstance | null = null

  try {
    const buildConfig = getAangBuildConfig()

    // Initialize Unity instance
    instance = (await loadUnityInstance(
      canvas,
      '/unity/Build/aang-renderer.loader.js',
      buildConfig.dataUrl,
      buildConfig.frameworkUrl,
      buildConfig.codeUrl,
      buildConfig.symbolUrl,
      '/emotes',
      'Decentraland',
      'AangRenderer',
      '2.2.2',
      true,
      [],
    )) as UnityInstance

    if (!instance) {
      throw new Error('Failed to load Unity instance')
    }

    const sceneController = createSceneController(instance)
    const emoteController = createEmoteController(instance, emote, socialEmote)
    const physicsController = createPhysicsController(instance)

    return {
      scene: sceneController,
      emote: emoteController,
      physics: physicsController,
      unity: instance,
    }
  } catch (error) {
    console.error('Unity render failed:', error)
    if (instance?.Quit) {
      try {
        instance.Quit()
      } catch (e) {
        console.error('Error quitting Unity instance:', e)
        captureException(e, { phase: 'unityQuit' })
      }
    }
    throw error
  }
}
