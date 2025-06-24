import { useState, useEffect, useRef } from 'react'

import {
  PreviewCamera,
  PreviewEmote,
  BodyShape,
  PreviewProjection,
  WearableDefinition,
  EmoteDefinition,
  PreviewType,
} from '@dcl/schemas'
import { config } from '../config'
import { colorToHex, formatHex } from '../lib/color'
import { fetchItemFromContract, fetchProfile, fetchProfileEntity, sanitizeProfile } from '../lib/config'
import { UnityPreviewMode, useOptions } from './useOptions'
import { isWearable } from '../lib/wearable'
import { isTexture } from '../lib/representation'
import { getWearableRepresentationOrDefault } from '../lib/representation'

export interface UnityPreviewConfig {
  background: { color: string; transparent: boolean; image?: string }
  mode: UnityPreviewMode
  type: PreviewType
  base64?: string
  bodyShape?: string
  contract?: string
  disableLoader?: boolean
  emote?: string
  eyeColor?: string
  hairColor?: string
  item?: string
  profile?: string
  projection?: string
  showAnimationReference?: boolean
  skinColor?: string
  token?: string
  urn?: string[]
}

// Batch update query parameters to avoid multiple reloads
function updateQueryParams(params: Record<string, string | string[]>) {
  const url = new URL(window.location.href)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.delete(key)

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== '') {
          url.searchParams.append(key, item)
        }
      })
    } else {
      if (value !== '') {
        url.searchParams.set(key, value)
      }
    }
  })

  window.history.replaceState({}, '', url.toString())
}

export function useUnityConfig(): [UnityPreviewConfig | null, boolean, string | null] {
  const options = useOptions()
  const [unityConfig, setUnityConfig] = useState<UnityPreviewConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const previousConfigRef = useRef<UnityPreviewConfig | null>(null)
  const previousOptionsRef = useRef<any>(null)

  useEffect(() => {
    // Only proceed if options have actually changed
    const currentOptionsString = JSON.stringify(options)
    const previousOptionsString = JSON.stringify(previousOptionsRef.current)

    if (currentOptionsString === previousOptionsString) {
      return
    }

    // Update the previous options reference when options change
    previousOptionsRef.current = options

    const loadConfig = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const peerUrl = options.peerUrl || config.get('PEER_URL')
        const nftServerUrl = options.nftServerUrl || config.get('NFT_SERVER_URL')

        let type = PreviewType.WEARABLE
        let background: { color: string; transparent: boolean; image?: string } = {
          color: options.background || '#4b4852',
          transparent: options.disableBackground === true,
        }

        const sanitizedProfile = sanitizeProfile(options.profile)
        // If profile is 'default', add a random postfix number from 1 to 159
        let profileValue = sanitizedProfile?.value
        if (profileValue === 'default') {
          const randomNumber = Math.floor(Math.random() * 159) + 1
          profileValue = `default${randomNumber}`
        }

        const profile =
          profileValue && sanitizedProfile
            ? sanitizedProfile.type === 'address'
              ? await fetchProfile(profileValue, peerUrl)
              : await fetchProfileEntity(profileValue, peerUrl)
            : null

        const bodyShape = options.bodyShape || (profile && (profile.avatar.bodyShape as BodyShape)) || BodyShape.MALE
        let item: WearableDefinition | EmoteDefinition | null = null
        if (options.contractAddress) {
          item = await fetchItemFromContract({
            contractAddress: options.contractAddress,
            tokenId: options.tokenId,
            itemId: options.itemId,
            peerUrl,
            nftServerUrl,
          })

          if (item && isWearable(item)) {
            background = {
              ...background,
              image: item.thumbnail,
            }
            const representation = getWearableRepresentationOrDefault(item)
            if (isTexture(representation)) {
              type = PreviewType.TEXTURE
            }
          }
        }

        // use colors from options, default to profile, if none, use default values
        const eyes = formatHex(options.eyes || (profile && colorToHex(profile.avatar.eyes.color)) || '000000')
        const hair = formatHex(options.hair || (profile && colorToHex(profile.avatar.hair.color)) || '000000')
        const skin = formatHex(options.skin || (profile && colorToHex(profile.avatar.skin.color)) || 'cc9b76')

        const mode = options.mode || UnityPreviewMode.MARKETPLACE

        const camera =
          options.camera && Object.values(PreviewCamera).includes(options.camera)
            ? options.camera
            : PreviewCamera.INTERACTIVE

        const projection =
          options.projection && Object.values(PreviewProjection).includes(options.projection)
            ? options.projection
            : PreviewProjection.PERSPECTIVE

        const emote = options.disableDefaultEmotes
          ? null
          : options.emote && Object.values(PreviewEmote).includes(options.emote)
            ? options.emote
            : PreviewEmote.IDLE

        const newConfig: UnityPreviewConfig = {
          background,
          bodyShape,
          mode,
          projection,
          type,
          base64: options.base64s && options.base64s.length > 0 ? options.base64s[0] : undefined,
          contract: options.contractAddress || undefined,
          disableLoader: options.disableLoader || false,
          emote: emote || undefined,
          eyeColor: eyes.replace('#', ''),
          hairColor: hair.replace('#', ''),
          item: options.itemId || undefined,
          profile: profileValue,
          skinColor: skin.replace('#', ''),
          token: options.tokenId || undefined,
          urn: options.urns || [],
        }

        // Only update query params if the config has actually changed
        const currentConfigString = JSON.stringify(newConfig)
        const previousConfigString = JSON.stringify(previousConfigRef.current)

        if (currentConfigString !== previousConfigString) {
          previousConfigRef.current = newConfig
          const queryParams: Record<string, string | string[]> = {}

          // Background
          if (background.transparent) {
            queryParams.background = ''
          } else {
            queryParams.background = background.color.replace('#', '')
          }

          // Disable unity loader by default
          if (options.disableLoader) {
            queryParams.disableLoader = 'true'
          }

          // Profile
          if (profile && sanitizedProfile && profileValue) {
            queryParams.profile = profileValue
          }

          queryParams.bodyShape = bodyShape
          queryParams.eyeColor = eyes.replace('#', '')
          queryParams.hairColor = hair.replace('#', '')
          queryParams.skinColor = skin.replace('#', '')
          queryParams.mode = mode
          queryParams.camera = camera
          queryParams.projection = projection
          queryParams.emote = emote || ''
          queryParams.urn = options.urns ? [...options.urns] : ''
          queryParams.base64 = options.base64s ? [...options.base64s] : ''

          // Update query parameters
          updateQueryParams(queryParams)

          setUnityConfig(newConfig)
        }
      } catch (err) {
        console.error('Error loading config:', err)
        setError(err instanceof Error ? err.message : 'Failed to load Unity config')
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [options])

  return [unityConfig, isLoading, error]
}
