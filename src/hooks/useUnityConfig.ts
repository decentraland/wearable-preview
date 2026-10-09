import { useState, useEffect, useRef } from 'react'

import {
  PreviewCamera,
  PreviewEmote,
  BodyShape,
  PreviewProjection,
  WearableDefinition,
  EmoteDefinition,
  PreviewType,
  PreviewUnityMode,
} from '@dcl/schemas'
import { SocialEmoteAnimation } from '@dcl/schemas/dist/dapps/preview/social-emote-animation'
import { config } from '../config'
import { parseHex } from '../lib/color'
import { fetchItemFromContract, fetchProfile, fetchProfileEntity, sanitizeProfile } from '../lib/config'
import { useOptions } from './useOptions'
import { isWearable } from '../lib/wearable'
import { isTexture } from '../lib/representation'
import { getWearableRepresentationOrDefault } from '../lib/representation'
import { getRandomDefaultProfile } from '../lib/profile'
import { inferHideControls } from '../lib/unity/controls'

export interface UnityPreviewConfig {
  background: Background
  mode: PreviewUnityMode | null
  type: PreviewType
  base64: string | null
  bodyShape: BodyShape | null
  contract: string | null
  disableLoader: boolean
  emote: string | null
  eyeColor: string | null
  hairColor: string | null
  item: string | null
  profile: string | null
  projection: PreviewProjection | null
  showAnimationReference: boolean | null
  skinColor: string | null
  token: string | null
  urn: string[] | null
  itemDefinition: WearableDefinition | EmoteDefinition | null
  socialEmote: SocialEmoteAnimation | null
  // The camera options Babylon takes, forwarded by name; the renderer scales them the same way.
  camera: PreviewCamera
  zoom: number | null
  wheelZoom: number | null
  wheelStart: number | null
  lockAlpha: boolean
  lockBeta: boolean
  lockRadius: boolean
  panning: boolean
  disableAutoRotate: boolean
  autoRotateSpeed: number | null
  offsetX: number | null
  offsetY: number | null
  showThumbnailBoundaries: boolean
}

interface Background {
  color: string
  transparent: boolean
  image?: string
}

type QueryParams = {
  background: string
  disableLoader: string
  profile: string
  bodyShape: string
  eyeColor: string
  hairColor: string
  skinColor: string
  mode: PreviewUnityMode | string
  camera: PreviewCamera
  projection: PreviewProjection
  emote: string
  type: string
  urn: string[]
  base64: string[]
  hideControls: string
  zoom: string
  wheelZoom: string
  wheelStart: string
  lockAlpha: string
  lockBeta: string
  lockRadius: string
  panning: string
  disableAutoRotate: string
  autoRotateSpeed: string
  offsetX: string
  offsetY: string
  showThumbnailBoundaries: string
}

// Only these two express a view the renderer can be pinned to: the item on its own or the item
// worn by an avatar. TEXTURE is not a view, it's resolved below from the item's representation and
// only tells the JS side to show the thumbnail instead of the canvas.
const getRequestedType = (type: PreviewType | null | undefined): PreviewType | null =>
  type === PreviewType.AVATAR || type === PreviewType.WEARABLE ? type : null

// The renderer already resolves the profile's own colors, and falls back to its own defaults when a
// color is left unset, so only a color the caller actually asked for has to travel.
const toColorOverride = (color: string | null | undefined): string | null => {
  if (!color) return null
  const parsed = parseHex(color)
  return parsed || null
}

// Convert potentially null/undefined values to string or empty string
const toQueryValue = (value: string | null | undefined): string => value || ''

// Convert potentially null/undefined array to string array
const toQueryArray = (value: string[] | null | undefined): string[] => value || []

// A number the caller actually passed, or null
const toNumberOption = (value: number | null | undefined): number | null =>
  typeof value === 'number' && !isNaN(value) ? value : null

// Convert a numeric option to its query value, or empty string when unset
const toQueryNumber = (value: number | null): string => (value === null ? '' : String(value))

// Convert a flag to its query value: only a set flag travels, the renderer defaults the rest
const toQueryFlag = (value: boolean): string => (value ? 'true' : '')

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
        const marketplaceServerUrl =
          options.marketplaceServerUrl || options.nftServerUrl || config.get('MARKETPLACE_SERVER_URL')

        // Initialize basic config
        // A caller that asked for a specific view gets it; when nobody asked we keep defaulting to
        // the item view, and the renderer decides (see PreviewController) which view to open in.
        const requestedType = getRequestedType(options.type)
        let type = requestedType || PreviewType.WEARABLE
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
            marketplaceServerUrl,
          })

          if (item && isWearable(item)) {
            background = {
              ...background,
              image: item.thumbnail,
            }
            const representation = getWearableRepresentationOrDefault(item)
            // An avatar can wear a texture-only wearable, so an explicit avatar request wins over
            // the texture fallback (same precedence as the Babylon path, see lib/config.ts).
            if (isTexture(representation) && type !== PreviewType.AVATAR) {
              type = PreviewType.TEXTURE
            }
          }
        }

        // Get colors
        const eyes = toColorOverride(options.eyes)
        const hair = toColorOverride(options.hair)
        const skin = toColorOverride(options.skin)

        // Get camera settings
        const mode = options.unityMode || null
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
          eyeColor: eyes,
          hairColor: hair,
          item: options.itemId || null,
          profile: profileValue || null,
          skinColor: skin,
          token: options.tokenId || null,
          urn: options.urns || null,
          showAnimationReference: null,
          itemDefinition: item,
          socialEmote: options.socialEmote || null,
          camera,
          zoom: toNumberOption(options.zoom),
          wheelZoom: toNumberOption(options.wheelZoom),
          wheelStart: toNumberOption(options.wheelStart),
          lockAlpha: !!options.lockAlpha,
          lockBeta: !!options.lockBeta,
          lockRadius: !!options.lockRadius,
          panning: options.panning !== false,
          disableAutoRotate: !!options.disableAutoRotate,
          autoRotateSpeed: toNumberOption(options.autoRotateSpeed),
          offsetX: toNumberOption(options.offsetX),
          offsetY: toNumberOption(options.offsetY),
          showThumbnailBoundaries: !!options.showThumbnailBoundaries,
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

            // For configurator mode, only add mode parameter
            if (mode === PreviewUnityMode.CONFIG) {
              const queryParams: Partial<QueryParams> = {
                mode: toQueryValue(mode || ''),
              }
              updateQueryParams(queryParams)
            } else {
              const queryParams: Partial<QueryParams> = {
                background: background.transparent ? '' : toQueryColor(background.color),
                disableLoader: options.disableLoader ? 'true' : '',
                profile: toQueryValue(profileValue || ''),
                bodyShape: toQueryValue(bodyShape || ''),
                eyeColor: toQueryValue(eyes),
                hairColor: toQueryValue(hair),
                skinColor: toQueryValue(skin),
                mode: toQueryValue(mode || ''),
                camera,
                projection,
                emote: toQueryValue(emote?.toString() || ''),
                // Unity reads its config from this URL, so the requested view has to travel here to
                // reach it. We forward the caller's request and not the resolved `type`: an empty
                // value means "no preference", which is what lets the renderer fall back to the
                // view the user last picked.
                type: toQueryValue(requestedType),
                urn: urns.length > 0 ? urns : [''],
                base64: base64s.length > 0 ? base64s : [''],
                zoom: toQueryNumber(newConfig.zoom),
                wheelZoom: toQueryNumber(newConfig.wheelZoom),
                wheelStart: toQueryNumber(newConfig.wheelStart),
                lockAlpha: toQueryFlag(newConfig.lockAlpha),
                lockBeta: toQueryFlag(newConfig.lockBeta),
                lockRadius: toQueryFlag(newConfig.lockRadius),
                // Defaults on, so only an explicit off has to travel
                panning: newConfig.panning ? '' : 'false',
                disableAutoRotate: toQueryFlag(newConfig.disableAutoRotate),
                autoRotateSpeed: toQueryNumber(newConfig.autoRotateSpeed),
                offsetX: toQueryNumber(newConfig.offsetX),
                offsetY: toQueryNumber(newConfig.offsetY),
                showThumbnailBoundaries: toQueryFlag(newConfig.showThumbnailBoundaries),
              }
              // Only ever set, never cleared: a hideControls the page put in the URL itself stays.
              if (inferHideControls(options)) {
                queryParams.hideControls = 'true'
              }
              updateQueryParams(queryParams)
            }
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
