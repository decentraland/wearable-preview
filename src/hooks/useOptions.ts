import { useMemo, useRef, useEffect, useState } from 'react'
import {
  BodyShape,
  PreviewCamera,
  PreviewEmote,
  PreviewOptions,
  PreviewProjection,
  PreviewType,
  PreviewUnityMode,
} from '@dcl/schemas'
import { SocialEmoteAnimation } from '@dcl/schemas/dist/dapps/preview/social-emote-animation'
import { parseZoom } from '../lib/zoom'
import { useOverrides } from './useOverrides'

export interface OptionsWithSource {
  options: PreviewOptions
  overrideSources: Record<string, boolean>
}

export const useOptions = (): OptionsWithSource => {
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams(window.location.search))
  const previousSearchRef = useRef<string>(window.location.search)

  // Update search params when URL changes
  useEffect(() => {
    const currentSearch = window.location.search
    if (currentSearch !== previousSearchRef.current) {
      setSearchParams(new URLSearchParams(currentSearch))
      previousSearchRef.current = currentSearch
    }
  })

  const options = useMemo<PreviewOptions>(() => {
    const autoRotateSpeedParam = searchParams.get('autoRotateSpeed') as string | null
    const offsetXParam = searchParams.get('offsetX') as string | null
    const offsetYParam = searchParams.get('offsetY') as string | null
    const offsetZParam = searchParams.get('offsetZ') as string | null
    const cameraXParam = searchParams.get('cameraX') as string | null
    const cameraYParam = searchParams.get('cameraY') as string | null
    const cameraZParam = searchParams.get('cameraZ') as string | null
    const zoomScaleParam = searchParams.get('zoomScale') as string | null
    const wheelZoomParam = searchParams.get('wheelZoom') as string | null
    const wheelPrecisionParam = searchParams.get('wheelPrecision') as string | null
    const wheelStartParam = searchParams.get('wheelStart') as string | null
    const bodyShapeParam = searchParams.get('bodyShape')
    const panning = searchParams.get('panning')
    const lockAlpha = searchParams.get('lockAlpha')
    const lockBeta = searchParams.get('lockBeta')
    const lockRadius = searchParams.get('lockRadius')
    const showSceneBoundariesParam = searchParams.get('showSceneBoundaries')
    const showThumbnailBoundariesParam = searchParams.get('showThumbnailBoundaries')
    const disableBackgroundParam = searchParams.get('disableBackground')
    const disableAutoCenterParam = searchParams.get('disableAutoCenter')
    const disableAutoRotateParam = searchParams.get('disableAutoRotate')
    const disableFaceParam = searchParams.get('disableFace')
    const disableDefaultWearablesParam = searchParams.get('disableDefaultWearables')
    const disableDefaultEmotesParam = searchParams.get('disableDefaultEmotes')
    const disableFadeEffectParam = searchParams.get('disableFadeEffect')

    const parseBooleanParam = (param: string | null | undefined): boolean => {
      return !!param && param !== 'false'
    }

    const transparentBackground = searchParams.has('transparentBackground')
    if (transparentBackground) {
      console.warn(
        `Deprecated: you are using the query param "transparentBackground" that has been deprecated in favor of "disableBackground". Please switch to the new query param since in the future this will not be supported.`,
      )
    }
    const centerBoundingBox = searchParams.get('centerBoundingBox') !== 'false'

    const options: PreviewOptions = {
      contractAddress: searchParams.get('contract')!,
      tokenId: searchParams.get('token'),
      itemId: searchParams.get('item'),
      skin: searchParams.get('skin'),
      hair: searchParams.get('hair'),
      eyes: searchParams.get('eyes'),
      emote: searchParams.get('emote') as PreviewEmote | null,
      camera: searchParams.get('camera') as PreviewCamera | null,
      projection: searchParams.get('projection') as PreviewProjection | null,
      background: searchParams.get('background'),
      autoRotateSpeed: autoRotateSpeedParam ? parseFloat(autoRotateSpeedParam) : null,
      offsetX: offsetXParam ? parseFloat(offsetXParam) : null,
      offsetY: offsetYParam ? parseFloat(offsetYParam) : null,
      offsetZ: offsetZParam ? parseFloat(offsetZParam) : null,
      cameraX: cameraXParam ? parseFloat(cameraXParam) : null,
      cameraY: cameraYParam ? parseFloat(cameraYParam) : null,
      cameraZ: cameraZParam ? parseFloat(cameraZParam) : null,
      wheelZoom: wheelZoomParam ? parseFloat(wheelZoomParam) : null,
      wheelPrecision: wheelPrecisionParam ? parseFloat(wheelPrecisionParam) : null,
      wheelStart: wheelStartParam ? parseFloat(wheelStartParam) : null,
      zoom: parseZoom(searchParams.get('zoom')),
      zoomScale: zoomScaleParam ? parseFloat(zoomScaleParam) : null,
      bodyShape:
        bodyShapeParam === 'female' || bodyShapeParam === BodyShape.FEMALE
          ? BodyShape.FEMALE
          : bodyShapeParam === 'male' || bodyShapeParam === BodyShape.MALE
            ? BodyShape.MALE
            : null,
      urns: searchParams.getAll('urn'),
      urls: searchParams.getAll('url'),
      base64s: searchParams.getAll('base64'),
      profile: searchParams.get('profile'),
      showSceneBoundaries: parseBooleanParam(showSceneBoundariesParam),
      showThumbnailBoundaries: parseBooleanParam(showThumbnailBoundariesParam),
      disableBackground: parseBooleanParam(disableBackgroundParam) || transparentBackground,
      disableAutoCenter: parseBooleanParam(disableAutoCenterParam) || !centerBoundingBox,
      disableAutoRotate: parseBooleanParam(disableAutoRotateParam) || !centerBoundingBox,
      disableFace: parseBooleanParam(disableFaceParam),
      disableDefaultWearables: parseBooleanParam(disableDefaultWearablesParam),
      disableDefaultEmotes: parseBooleanParam(disableDefaultEmotesParam),
      disableFadeEffect: parseBooleanParam(disableFadeEffectParam),
      peerUrl: searchParams.get('peerUrl'),
      marketplaceServerUrl: searchParams.get('marketplaceServerUrl'),
      nftServerUrl: searchParams.get('nftServerUrl'),
      type: searchParams.get('type') as PreviewType | null,
      panning: panning === 'true' || panning === null,
      lockAlpha: lockAlpha === 'true',
      lockBeta: lockBeta === 'true',
      lockRadius: lockRadius === 'true',
      unityMode: searchParams.get('mode') as PreviewUnityMode | null,
      disableLoader: searchParams.has('disableLoader'),
      username: searchParams.get('username'),
      socialEmote: (() => {
        const socialEmoteParam = searchParams.get('socialEmote')
        if (!socialEmoteParam) return null
        try {
          return JSON.parse(socialEmoteParam) as SocialEmoteAnimation
        } catch {
          return null
        }
      })(),
    }

    return options
  }, [searchParams])

  // apply overrides
  const overrides = useOverrides()
  const optionsWithOverrides = useMemo(() => {
    const mergedOptions = {
      ...options,
      ...overrides,
    }

    // Track which properties came from overrides
    const overrideSources: Record<string, boolean> = {}
    Object.keys(overrides).forEach((key) => {
      if (overrides[key as keyof PreviewOptions] !== undefined) {
        overrideSources[key] = true
      }
    })

    return {
      options: mergedOptions,
      overrideSources,
    }
  }, [options, overrides])

  // return options with overrides applied (if any) and source tracking
  return optionsWithOverrides
}
