import { useState, useEffect } from 'react'
import { PreviewType, PreviewCamera, PreviewEmote, PreviewConfig, BodyShape, PreviewProjection } from '@dcl/schemas'
import { UnityPreviewMode, useOptions } from './useOptions'

// Extend PreviewConfig to include mode
export interface UnityPreviewConfig extends PreviewConfig {
  mode?: UnityPreviewMode
}

// Basic utility to update a query param
function updateQueryParam(key: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState({}, '', url.toString())
}

export function useUnityConfig(): [UnityPreviewConfig | null, boolean, string | null] {
  const options = useOptions()
  const [config, setConfig] = useState<UnityPreviewConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Determine preview type
        let type = PreviewType.WEARABLE
        if (
          (options.urns && options.urns.length > 0) ||
          (options.urls && options.urls.length > 0) ||
          (options.base64s && options.base64s.length > 0) ||
          options.profile
        ) {
          type = PreviewType.AVATAR
        }

        const background = {
          color: options.background || '#4b4852',
          transparent: options.disableBackground === true,
        }
        if (!background.transparent) {
          updateQueryParam('background', background.color.replace('#', ''))
        }

        // Disable unity loader by default
        if (options.disableLoader) {
          updateQueryParam('disableLoader', 'true')
        }

        const eyes = options.eyes || '000000'
        updateQueryParam('eyes', eyes.replace('#', ''))

        const hair = options.hair || '000000'
        updateQueryParam('hair', hair.replace('#', ''))

        const skin = options.skin || 'cc9b76'
        updateQueryParam('skin', skin.replace('#', ''))

        const mode = options.mode || UnityPreviewMode.MARKETPLACE
        updateQueryParam('mode', mode)

        const camera =
          options.camera && Object.values(PreviewCamera).includes(options.camera)
            ? options.camera
            : PreviewCamera.INTERACTIVE
        updateQueryParam('camera', camera)

        let emote: PreviewEmote | null = null
        if (!options.disableDefaultEmotes) {
          emote =
            options.emote && Object.values(PreviewEmote).includes(options.emote) ? options.emote : PreviewEmote.IDLE
        }

        const newConfig: UnityPreviewConfig = {
          background,
          camera,
          emote,
          eyes,
          hair,
          mode,
          skin,
          type,
          autoRotateSpeed: options.disableAutoRotate ? 0 : 0.2,
          bodyShape: options.bodyShape || BodyShape.MALE,
          cameraX: options.cameraX || 0,
          cameraY: options.cameraY || 1,
          cameraZ: options.cameraZ || 3.5,
          centerBoundingBox: !options.disableAutoCenter,
          face: !options.disableFace,
          fadeEffect: !options.disableFadeEffect,
          lockAlpha: options.lockAlpha || false,
          lockBeta: options.lockBeta || false,
          lockRadius: options.lockRadius || false,
          offsetX: options.offsetX || 0,
          offsetY: options.offsetY || 0,
          offsetZ: options.offsetZ || 0,
          panning: options.panning || false,
          projection: options.projection || PreviewProjection.PERSPECTIVE,
          showSceneBoundaries: options.showSceneBoundaries || false,
          showThumbnailBoundaries: options.showThumbnailBoundaries || false,
          wearables: [],
          wheelStart: options.wheelStart || 50,
          wheelPrecision: options.wheelPrecision || 100,
          wheelZoom: options.wheelZoom || 1,
          zoom: options.zoom || 1.75,
        }

        console.log('Config created successfully:', newConfig)
        setConfig(newConfig)
      } catch (err) {
        console.error('Error loading config:', err)
        setError(err instanceof Error ? err.message : 'Failed to load Unity config')
      } finally {
        console.log('Setting isLoading to false')
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [options])

  return [config, isLoading, error]
}
