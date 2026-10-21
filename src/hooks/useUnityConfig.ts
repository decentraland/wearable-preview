import { useState, useEffect, useRef, MutableRefObject } from 'react'

import {
  PreviewCamera,
  PreviewEmote,
  BodyShape,
  PreviewProjection,
  WearableDefinition,
  EmoteDefinition,
  PreviewType,
  PreviewUnityMode,
  Rarity,
  isStandard,
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
import { getRandomSocialEmoteAnimation, isEmote } from '../lib/emote'

// The renderer's emote value that plays none
const NO_EMOTE = 'none'

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
  urls: string[] | null
  itemDefinition: WearableDefinition | EmoteDefinition | null
  socialEmote: SocialEmoteAnimation | null
  disableFace: boolean
  disableDefaultWearables: boolean
  peerUrl: string | null
  marketplaceServerUrl: string | null
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
  offsetZ: number | null
  cameraX: number | null
  cameraY: number | null
  cameraZ: number | null
  wheelPrecision: number | null
  zoomScale: number | null
  disableAutoCenter: boolean
  showThumbnailBoundaries: boolean
  showSceneBoundaries: boolean
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
  url: string[]
  hideControls: string
  disableFace: string
  disableDefaultWearables: string
  peerUrl: string
  marketplaceServerUrl: string
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
  offsetZ: string
  cameraX: string
  cameraY: string
  cameraZ: string
  wheelPrecision: string
  zoomScale: string
  disableAutoCenter: string
  showThumbnailBoundaries: string
  showSceneBoundaries: string
  socialEmote: string
  shadow: string
  glow: string
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

// One of a social emote's outcomes at random, picked once per item and kept in `pick`
const pickSocialEmote = (
  pick: MutableRefObject<{ id: string; animation: SocialEmoteAnimation | null } | null>,
  item: WearableDefinition | EmoteDefinition | null,
): SocialEmoteAnimation | null => {
  if (!item || !isEmote(item)) return null
  if (pick.current?.id !== item.id) {
    pick.current = { id: item.id, animation: getRandomSocialEmoteAnimation(item as EmoteDefinition) }
  }
  return pick.current.animation
}

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
  // The outcome picked at random for a social emote, kept per item so an unrelated option change
  // does not switch it.
  const socialEmotePickRef = useRef<{ id: string; animation: SocialEmoteAnimation | null } | null>(null)
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

          // A published item sits on its rarity colour unless the page chose one, as in lib/config.ts
          if (item && isStandard(item) && !options.background) {
            background = { ...background, color: Rarity.getColor(item.rarity) }
          }
        }

        // Get colors
        const eyes = toColorOverride(options.eyes)
        const hair = toColorOverride(options.hair)
        const skin = toColorOverride(options.skin)

        // A mount that names no mode is a Babylon one. Marketplace is the mode whose loading rules
        // match Babylon's: the profile dresses the avatar and a lone item can be shown on its own.
        const mode = options.unityMode || PreviewUnityMode.MARKETPLACE

        // Babylon shows a lone item on its own, and anything with a profile, several items or an
        // emote on the avatar. A mount that names no mode gets that rule for its view too; one that
        // does keeps the renderer's own fallback to the view the user last picked.
        const babylonType =
          (options.urns?.length ?? 0) > 0 ||
          (options.urls?.length ?? 0) > 0 ||
          (options.base64s?.length ?? 0) > 0 ||
          (item && isEmote(item)) ||
          options.profile
            ? PreviewType.AVATAR
            : PreviewType.WEARABLE
        const forwardedType = requestedType || (options.unityMode ? null : babylonType)
        const camera =
          options.camera && Object.values(PreviewCamera).includes(options.camera as PreviewCamera)
            ? (options.camera as PreviewCamera)
            : PreviewCamera.INTERACTIVE
        const projection =
          options.projection && Object.values(PreviewProjection).includes(options.projection as PreviewProjection)
            ? (options.projection as PreviewProjection)
            : PreviewProjection.PERSPECTIVE

        // Handle emote
        const emote: string = options.disableDefaultEmotes
          ? NO_EMOTE
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
          emote,
          eyeColor: eyes,
          hairColor: hair,
          item: options.itemId || null,
          profile: profileValue || null,
          skinColor: skin,
          token: options.tokenId || null,
          urn: options.urns || null,
          urls: options.urls || null,
          showAnimationReference: null,
          itemDefinition: item,
          // The page's choice, or one of a social emote's outcomes at random, as lib/config.ts picks
          // it. Picked here rather than by the renderer, so the emote controller reports the one playing.
          socialEmote: options.socialEmote || pickSocialEmote(socialEmotePickRef, item),
          disableFace: !!options.disableFace,
          disableDefaultWearables: !!options.disableDefaultWearables,
          peerUrl: options.peerUrl || null,
          marketplaceServerUrl: options.marketplaceServerUrl || options.nftServerUrl || null,
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
          offsetZ: toNumberOption(options.offsetZ),
          cameraX: toNumberOption(options.cameraX),
          cameraY: toNumberOption(options.cameraY),
          cameraZ: toNumberOption(options.cameraZ),
          wheelPrecision: toNumberOption(options.wheelPrecision),
          zoomScale: toNumberOption(options.zoomScale),
          disableAutoCenter: !!options.disableAutoCenter,
          showThumbnailBoundaries: !!options.showThumbnailBoundaries,
          showSceneBoundaries: !!options.showSceneBoundaries,
        }

        // Only update if config has changed
        const currentConfigString = JSON.stringify(newConfig)
        const previousConfigString = JSON.stringify(previousConfigRef.current)

        if (currentConfigString !== previousConfigString) {
          previousConfigRef.current = newConfig

          // Only update query parameters if no overrides are present
          if (Object.keys(overrideSources).length === 0) {
            const urns = toQueryArray(options.urns)
            const urls = toQueryArray(options.urls)
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
                emote,
                // Unity reads its config from this URL, so the requested view has to travel here to
                // reach it. An empty value means "no preference", which is what lets the renderer
                // fall back to the view the user last picked.
                type: toQueryValue(forwardedType),
                urn: urns.length > 0 ? urns : [''],
                url: urls.length > 0 ? urls : [''],
                base64: base64s.length > 0 ? base64s : [''],
                disableFace: toQueryFlag(newConfig.disableFace),
                disableDefaultWearables: toQueryFlag(newConfig.disableDefaultWearables),
                peerUrl: toQueryValue(newConfig.peerUrl),
                marketplaceServerUrl: toQueryValue(newConfig.marketplaceServerUrl),
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
                offsetZ: toQueryNumber(newConfig.offsetZ),
                cameraX: toQueryNumber(newConfig.cameraX),
                cameraY: toQueryNumber(newConfig.cameraY),
                cameraZ: toQueryNumber(newConfig.cameraZ),
                wheelPrecision: toQueryNumber(newConfig.wheelPrecision),
                zoomScale: toQueryNumber(newConfig.zoomScale),
                disableAutoCenter: toQueryFlag(newConfig.disableAutoCenter),
                showThumbnailBoundaries: toQueryFlag(newConfig.showThumbnailBoundaries),
                showSceneBoundaries: toQueryFlag(newConfig.showSceneBoundaries),
                socialEmote: newConfig.socialEmote ? JSON.stringify(newConfig.socialEmote) : '',
              }
              // A transparent background is a capture for a thumbnail, where the floor shadow and glow
              // would print into it; Babylon draws neither. Only ever set, as hideControls below.
              if (background.transparent) {
                queryParams.shadow = 'off'
                queryParams.glow = 'off'
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
