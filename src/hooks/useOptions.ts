import { useMemo, useRef, useEffect, useState } from 'react'
import { BodyShape, PreviewCamera, PreviewEmote, PreviewOptions, PreviewProjection, PreviewType } from '@dcl/schemas'
import { parseZoom } from '../lib/zoom'
import { useOverrides } from './useOverrides'

export enum UnityPreviewMode {
  PROFILE = 'profile',
  MARKETPLACE = 'marketplace',
  AUTHENTICATION = 'authentication',
  BUILDER = 'builder',
}

export const useOptions = () => {
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

  const options = useMemo<PreviewOptions & { mode: UnityPreviewMode | null; disableLoader: boolean }>(() => {
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

    const transparentBackground = searchParams.has('transparentBackground')
    if (transparentBackground) {
      console.warn(
        `Deprecated: you are using the query param "transparentBackground" that has been deprecated in favor of "disableBackground". Please switch to the new query param since in the future this will not be supported.`,
      )
    }
    const centerBoundingBox = searchParams.get('centerBoundingBox') !== 'false'

    const options: PreviewOptions & { mode: UnityPreviewMode | null; disableLoader: boolean } = {
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
      showSceneBoundaries: searchParams.has('showSceneBoundaries') || false,
      showThumbnailBoundaries: searchParams.has('showThumbnailBoundaries') || false,
      disableBackground: searchParams.has('disableBackground') || transparentBackground,
      disableAutoCenter: searchParams.has('disableAutoCenter') || !centerBoundingBox,
      disableAutoRotate: searchParams.has('disableAutoRotate') || !centerBoundingBox,
      disableFace: searchParams.has('disableFace'),
      disableDefaultWearables: searchParams.has('disableDefaultWearables'),
      disableDefaultEmotes: searchParams.has('disableDefaultEmotes'),
      disableFadeEffect: searchParams.has('disableFadeEffect'),
      peerUrl: searchParams.get('peerUrl'),
      nftServerUrl: searchParams.get('nftServerUrl'),
      type: searchParams.get('type') as PreviewType | null,
      panning: panning === 'true' || panning === null,
      lockAlpha: lockAlpha === 'true',
      lockBeta: lockBeta === 'true',
      lockRadius: lockRadius === 'true',
      mode: searchParams.get('mode') as UnityPreviewMode | null,
      disableLoader: searchParams.has('disableLoader') || true,
    }
    return options
  }, [searchParams])

  // apply overrides
  const overrides = useOverrides()
  const optionsWithOverrides = useMemo(
    () => ({
      ...options,
      ...overrides,
    }),
    [options, overrides],
  )

  // return options with overrides applied (if any)
  return optionsWithOverrides
}
