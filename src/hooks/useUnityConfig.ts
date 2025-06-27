import { useState, useEffect, useRef } from 'react'

import {
  PreviewCamera,
  PreviewEmote,
  BodyShape,
  PreviewProjection,
  WearableDefinition,
  EmoteDefinition,
  PreviewType,
  Avatar,
} from '@dcl/schemas'
import { config } from '../config'
import { colorToHex, formatHex } from '../lib/color'
import { fetchItemFromContract, fetchProfile, fetchProfileEntity, sanitizeProfile } from '../lib/config'
import { UnityPreviewMode, useOptions } from './useOptions'
import { isWearable } from '../lib/wearable'
import { isTexture } from '../lib/representation'
import { getWearableRepresentationOrDefault } from '../lib/representation'
import { getRandomDefaultProfile } from '../lib/profile'

export interface UnityPreviewConfig {
  background: Background
  mode: UnityPreviewMode | null
  type: PreviewType
  base64: string | null
  bodyShape: BodyShape | null
  contract: string | null
  disableLoader: boolean
  emote: string | null
  eyeColor: string
  hairColor: string
  item: string | null
  profile: string | null
  projection: PreviewProjection | null
  showAnimationReference: boolean | null
  skinColor: string
  token: string | null
  urn: string[] | null
}

interface Background {
  color: string
  transparent: boolean
  image?: string
}

interface AvatarColors {
  eyes: string
  hair: string
  skin: string
}

type QueryParams = {
  background: string
  disableLoader: string
  profile: string
  bodyShape: string
  eyeColor: string
  hairColor: string
  skinColor: string
  mode: UnityPreviewMode | string
  camera: PreviewCamera
  projection: PreviewProjection
  emote: string
  urn: string[]
  base64: string[]
}

// Helper functions
const getRandomProfileNumber = () => Math.floor(Math.random() * 159) + 1

const getDefaultColors = (
  profile: Avatar | null,
  options: { eyes?: string | null; hair?: string | null; skin?: string | null },
): AvatarColors => ({
  eyes: formatHex(options.eyes || (profile?.avatar?.eyes?.color && colorToHex(profile.avatar.eyes.color)) || '#000000'),
  hair: formatHex(options.hair || (profile?.avatar?.hair?.color && colorToHex(profile.avatar.hair.color)) || '#000000'),
  skin: formatHex(options.skin || (profile?.avatar?.skin?.color && colorToHex(profile.avatar.skin.color)) || '#cc9b76'),
})

// Convert potentially null/undefined values to string or empty string
const toQueryValue = (value: string | null | undefined): string => value || ''

// Convert potentially null/undefined array to string array
const toQueryArray = (value: string[] | null | undefined): string[] => value || []

// Convert color value to hex string without #
const toQueryColor = (value: string): string => value.replace('#', '')

// Batch update query parameters to avoid multiple reloads
function updateQueryParams(params: Partial<QueryParams>): void {
  const url = new URL(window.location.href)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.delete(key)

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== '') {
          url.searchParams.append(key, item)
        }
      })
    } else if (value !== '') {
      url.searchParams.set(key, value)
    }
  })

  window.history.replaceState({}, '', url.toString())
}

export function useUnityConfig(): [UnityPreviewConfig | null, boolean, string | null] {
  const { options, overrideSources } = useOptions()

  const [unityConfig, setUnityConfig] = useState<UnityPreviewConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const previousConfigRef = useRef<UnityPreviewConfig | null>(null)
  const previousOptionsRef = useRef(options)
  const isFirstMount = useRef(true)

  useEffect(() => {
    // Only proceed if options have actually changed
    const currentOptionsString = JSON.stringify(options)
    const previousOptionsString = JSON.stringify(previousOptionsRef.current)

    if (!isFirstMount.current && currentOptionsString === previousOptionsString) {
      return
    }

    // After first mount, set flag to false
    isFirstMount.current = false

    // Update the previous options reference when options change
    previousOptionsRef.current = options

    const loadConfig = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Initialize URLs
        const peerUrl = options.peerUrl || config.get('PEER_URL')
        const nftServerUrl = options.nftServerUrl || config.get('NFT_SERVER_URL')

        // Initialize basic config
        let type = PreviewType.WEARABLE
        let background: Background = {
          color: options.background || '#4b4852',
          transparent: options.disableBackground === true,
        }

        // Handle profile
        const sanitizedProfile = sanitizeProfile(options.profile)
        let profileValue = sanitizedProfile?.value
        if (profileValue === 'default') {
          profileValue = getRandomDefaultProfile()
        }

        // Fetch profile and get the first avatar if available
        const profile =
          profileValue && sanitizedProfile
            ? sanitizedProfile.type === 'address'
              ? await fetchProfile(profileValue, peerUrl)
              : await fetchProfileEntity(profileValue, peerUrl)
            : null

        // Get body shape
        const bodyShape = (options.bodyShape ||
          (profile?.avatar?.bodyShape as BodyShape) ||
          BodyShape.MALE) as BodyShape

        // Handle item and background
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

        // Get colors
        const { eyes, hair, skin } = getDefaultColors(profile, {
          eyes: options.eyes,
          hair: options.hair,
          skin: options.skin,
        })

        // Get camera settings
        const mode = options.mode || null
        const camera =
          options.camera && Object.values(PreviewCamera).includes(options.camera as PreviewCamera)
            ? (options.camera as PreviewCamera)
            : PreviewCamera.INTERACTIVE
        const projection =
          options.projection && Object.values(PreviewProjection).includes(options.projection as PreviewProjection)
            ? (options.projection as PreviewProjection)
            : PreviewProjection.PERSPECTIVE

        // Handle emote
        const emote = options.disableDefaultEmotes
          ? null
          : options.emote && Object.values(PreviewEmote).includes(options.emote as PreviewEmote)
            ? (options.emote as PreviewEmote)
            : PreviewEmote.IDLE

        const newConfig: UnityPreviewConfig = {
          background,
          bodyShape,
          mode,
          projection,
          type,
          base64: options.base64s?.[0] || null,
          contract: options.contractAddress || null,
          disableLoader: options.disableLoader || false,
          emote: emote?.toString() || null,
          eyeColor: eyes.replace('#', ''),
          hairColor: hair.replace('#', ''),
          item: options.itemId || null,
          profile: profileValue || null,
          skinColor: skin.replace('#', ''),
          token: options.tokenId || null,
          urn: options.urns || null,
          showAnimationReference: null,
        }

        // Only update if config has changed
        const currentConfigString = JSON.stringify(newConfig)
        const previousConfigString = JSON.stringify(previousConfigRef.current)

        if (currentConfigString !== previousConfigString) {
          previousConfigRef.current = newConfig

          // Only update query parameters if no overrides are present
          if (Object.keys(overrideSources).length === 0) {
            const urns = toQueryArray(options.urns)
            const base64s = toQueryArray(options.base64s)

            const queryParams: Partial<QueryParams> = {
              background: background.transparent ? '' : toQueryColor(background.color),
              disableLoader: options.disableLoader ? 'true' : '',
              profile: toQueryValue(profileValue || ''),
              bodyShape: toQueryValue(bodyShape || ''),
              eyeColor: toQueryColor(eyes || ''),
              hairColor: toQueryColor(hair || ''),
              skinColor: toQueryColor(skin || ''),
              mode: toQueryValue(mode || ''),
              camera,
              projection,
              emote: toQueryValue(emote?.toString() || ''),
              urn: urns.length > 0 ? urns : [''],
              base64: base64s.length > 0 ? base64s : [''],
            }
            updateQueryParams(queryParams)
          }
          setUnityConfig(newConfig)
        }

        setIsLoading(false)
      } catch (err) {
        console.error('[useUnityConfig] Failed to load config:', err)
        setError(err instanceof Error ? err.message : 'Failed to load config')
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [options, overrideSources])

  return [unityConfig, isLoading, error]
}
