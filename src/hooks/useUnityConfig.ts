import { useState, useEffect } from 'react'
import { PreviewType, PreviewCamera, PreviewEmote, PreviewConfig, BodyShape, PreviewProjection } from '@dcl/schemas'
import { config } from '../config'
import { colorToHex, formatHex } from '../lib/color'
import { fetchProfile, fetchProfileEntity, sanitizeProfile } from '../lib/config'
import { UnityPreviewMode, useOptions } from './useOptions'

// Extend PreviewConfig to include mode
export interface UnityPreviewConfig extends PreviewConfig {
  mode?: UnityPreviewMode
}

// Basic utility to update a query param
function updateQueryParam(key: string, value: string) {
  const url = new URL(window.location.href)
  if (value === '') {
    url.searchParams.delete(key)
  } else {
    url.searchParams.set(key, value)
  }
  window.history.replaceState({}, '', url.toString())
}

export function useUnityConfig(): [UnityPreviewConfig | null, boolean, string | null] {
  const options = useOptions()
  const [unityConfig, setUnityConfig] = useState<UnityPreviewConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const peerUrl = options.peerUrl || config.get('PEER_URL')

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

        if (background.transparent) {
          updateQueryParam('background', '')
        } else {
          updateQueryParam('background', background.color.replace('#', ''))
        }

        // Disable unity loader by default
        if (options.disableLoader) {
          updateQueryParam('disableLoader', 'true')
        }

        const sanitizedProfile = sanitizeProfile(options.profile)
        const profile = sanitizedProfile
          ? sanitizedProfile.type === 'address'
            ? await fetchProfile(sanitizedProfile.value, peerUrl)
            : await fetchProfileEntity(sanitizedProfile.value, peerUrl)
          : null
        if (profile && sanitizedProfile) {
          updateQueryParam('profile', sanitizedProfile.value)
        }

        const bodyShape = options.bodyShape || (profile && (profile.avatar.bodyShape as BodyShape)) || BodyShape.MALE
        updateQueryParam('bodyShape', bodyShape)

        // use colors from options, default to profile, if none, use default values
        const eyes = formatHex(options.eyes || (profile && colorToHex(profile.avatar.eyes.color)) || '000000')
        updateQueryParam('eyes', eyes.replace('#', ''))

        const hair = formatHex(options.hair || (profile && colorToHex(profile.avatar.hair.color)) || '000000')
        updateQueryParam('hair', hair.replace('#', ''))

        const skin = formatHex(options.skin || (profile && colorToHex(profile.avatar.skin.color)) || 'cc9b76')
        updateQueryParam('skin', skin.replace('#', ''))

        const mode = options.mode || UnityPreviewMode.MARKETPLACE
        updateQueryParam('mode', mode)

        const camera =
          options.camera && Object.values(PreviewCamera).includes(options.camera)
            ? options.camera
            : PreviewCamera.INTERACTIVE
        updateQueryParam('camera', camera)

        const projection =
          options.projection && Object.values(PreviewProjection).includes(options.projection)
            ? options.projection
            : PreviewProjection.PERSPECTIVE
        updateQueryParam('projection', projection)

        const emote = options.disableDefaultEmotes
          ? null
          : options.emote && Object.values(PreviewEmote).includes(options.emote)
            ? options.emote
            : PreviewEmote.IDLE
        updateQueryParam('emote', emote || '')

        const newConfig: UnityPreviewConfig = {
          background,
          bodyShape,
          camera,
          emote,
          eyes,
          hair,
          mode,
          projection,
          skin,
          type,
          // The following properties are not supported by the Unity preview:
          autoRotateSpeed: options.disableAutoRotate ? 0 : 0.2,
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
          showSceneBoundaries: options.showSceneBoundaries || false,
          showThumbnailBoundaries: options.showThumbnailBoundaries || false,
          wearables: [],
          wheelStart: options.wheelStart || 50,
          wheelPrecision: options.wheelPrecision || 100,
          wheelZoom: options.wheelZoom || 1,
          zoom: options.zoom || 1.75,
        }

        console.log('Config created successfully:', newConfig)
        setUnityConfig(newConfig)
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

  return [unityConfig, isLoading, error]
}
