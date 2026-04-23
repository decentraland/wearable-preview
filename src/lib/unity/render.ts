import { BodyShape, IPreviewController, PreviewEmote, SpringBoneParams, WearableDefinition } from '@dcl/schemas'
import { UnityPreviewConfig } from '../../hooks/useUnityConfig'
import { captureException } from '../sentry'
import { isEmote } from '../emote'
import { isWearable } from '../wearable'
import { getWearableRepresentation } from '../representation'
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
 * Extracts spring bone params from a wearable's metadata (data.springBones) for a given body shape.
 * Returns null if no spring bone metadata is present for this wearable/representation.
 */
function getSpringBoneParamsFromMetadata(
  wearable: WearableDefinition,
  bodyShape: BodyShape,
): Record<string, SpringBoneParams> | null {
  const data = wearable.data as any
  const springBones = data?.springBones
  if (!springBones || !springBones.models) return null

  let filename: string | null = null
  try {
    const representation = getWearableRepresentation(wearable, bodyShape)
    filename = representation.mainFile
  } catch {
    try {
      const otherShape = bodyShape === BodyShape.MALE ? BodyShape.FEMALE : BodyShape.MALE
      const representation = getWearableRepresentation(wearable, otherShape)
      filename = representation.mainFile
    } catch {
      return null
    }
  }

  if (!filename) return null

  const modelParams = springBones.models[filename]
  if (!modelParams || typeof modelParams !== 'object') return null

  return modelParams as Record<string, SpringBoneParams>
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

    const emoteDefinition = config?.itemDefinition && isEmote(config.itemDefinition) ? config.itemDefinition : null
    const socialEmote = config?.socialEmote || undefined
    const previewEmote = (config?.emote as PreviewEmote) || null

    const sceneController = createSceneController(instance)
    const emoteController = createEmoteController(instance, emoteDefinition, socialEmote, previewEmote)
    const physicsController = createPhysicsController(instance)

    // Apply spring bone params from wearable metadata if available (standalone preview)
    if (config?.itemDefinition && isWearable(config.itemDefinition)) {
      const bodyShape = (config.bodyShape as BodyShape) || BodyShape.MALE
      const metadataParams = getSpringBoneParamsFromMetadata(config.itemDefinition, bodyShape)
      if (metadataParams) {
        physicsController.setSpringBonesParams(config.itemDefinition.id, metadataParams)
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
