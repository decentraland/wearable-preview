import { IPreviewController, PreviewEmote } from '@dcl/schemas'
import { UnityPreviewConfig } from '../../hooks/useUnityConfig'
import { captureException } from '../sentry'
import { isEmote } from '../emote'
import { getSpringBoneParamsFromMetadata, isWearable } from '../wearable'
import { loadUnityInstance } from './loader'
import { createSceneController } from './scene'
import { createEmoteController } from './emote'
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
  loaderUrl: string
  streamingAssetsUrl: string
}

// UPDATE THIS URL WITH LATEST AANG BUILD PREVIEW URL:
const REMOTE_BASE_URL = 'https://aang-renderer-qijg7l1tx-decentraland1.vercel.app/'

const COMPRESSED_AANG_BUILD: AangBuildConfig = {
  dataUrl: '/unity/Build/aang-renderer.data.br',
  frameworkUrl: '/unity/Build/aang-renderer.framework.js.br',
  codeUrl: '/unity/Build/aang-renderer.wasm.br',
  symbolUrl: '/unity/Build/aang-renderer.symbols.json.br',
  loaderUrl: '/unity/Build/aang-renderer.loader.js',
  streamingAssetsUrl: '/emotes',
}

const UNCOMPRESSED_AANG_BUILD: AangBuildConfig = {
  dataUrl: '/unity/Build/aang-renderer.data',
  frameworkUrl: '/unity/Build/aang-renderer.framework.js',
  codeUrl: '/unity/Build/aang-renderer.wasm',
  symbolUrl: '/unity/Build/aang-renderer.symbols.json',
  loaderUrl: '/unity/Build/aang-renderer.loader.js',
  streamingAssetsUrl: '/emotes',
}

function buildRemoteAangConfig(remoteBaseUrl: string): AangBuildConfig {
  const base = remoteBaseUrl.replace(/\/$/, '')
  return {
    dataUrl: `${base}/Build/aang-renderer.data`,
    frameworkUrl: `${base}/Build/aang-renderer.framework.js`,
    codeUrl: `${base}/Build/aang-renderer.wasm`,
    symbolUrl: `${base}/Build/aang-renderer.symbols.json`,
    loaderUrl: `${base}/Build/aang-renderer.loader.js`,
    streamingAssetsUrl: `${base}/StreamingAssets`,
  }
}

function getAangBuildConfig(): AangBuildConfig {
  // TODO: remove this remote config fallback before merging.
  return buildRemoteAangConfig(REMOTE_BASE_URL)

  if (process.env.NODE_ENV !== 'production' && import.meta.env.VITE_AANG_USE_UNCOMPRESSED === 'true') {
    console.log('[UNITY] Using uncompressed Aang build')
    return UNCOMPRESSED_AANG_BUILD
  }

  return COMPRESSED_AANG_BUILD
}

/**
 * Initializes Unity and creates the scene with the given configuration
 * @param canvas The canvas element where Unity will render
 * @param config The configuration for the preview (wearables, emote, etc.)
 */
export async function render(
  canvas: HTMLCanvasElement,
  config?: UnityPreviewConfig,
): Promise<IPreviewController & { unity: UnityInstance }> {
  let instance: UnityInstance | null = null

  try {
    const buildConfig = getAangBuildConfig()

    // Initialize Unity instance
    instance = (await loadUnityInstance(
      canvas,
      buildConfig.loaderUrl,
      buildConfig.dataUrl,
      buildConfig.frameworkUrl,
      buildConfig.codeUrl,
      buildConfig.symbolUrl,
      buildConfig.streamingAssetsUrl,
      'Decentraland',
      'AangRenderer',
      '2.2.2',
      true,
      [],
    )) as UnityInstance

    if (!instance) {
      throw new Error('Failed to load Unity instance')
    }

    const emoteDefinition = config?.itemDefinition && isEmote(config.itemDefinition) ? config.itemDefinition : null
    const socialEmote = config?.socialEmote || undefined
    const previewEmote = (config?.emote as PreviewEmote) || null

    const sceneController = createSceneController(instance)
    const emoteController = createEmoteController(instance, emoteDefinition, socialEmote, previewEmote)
    const physicsController = createPhysicsController(instance)

    // Apply spring bone params from wearable metadata if available (standalone preview)
    if (config?.itemDefinition && config.bodyShape && isWearable(config.itemDefinition)) {
      const springBonesParams = getSpringBoneParamsFromMetadata(config.itemDefinition, config.bodyShape)
      if (springBonesParams) {
        physicsController.setSpringBonesParams(config.itemDefinition.id, springBonesParams)
      }
    }

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
