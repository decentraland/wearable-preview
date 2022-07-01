import { useMemo, useState } from 'react'
import { useOverrides } from './useOverrides'

import { BodyShape, PreviewCamera, PreviewEmote, PreviewEnv, PreviewOptions } from '@dcl/schemas'
import { parseZoom } from '../lib/zoom'

export const useOptions = () => {
  // get options from url params
  const [search] = useState(window.location.search.toString())
  const options = useMemo<PreviewOptions>(() => {
    const params = new URLSearchParams(search)
    const autoRotateSpeedParam = params.get('autoRotateSpeed') as string | null
    const offsetXParam = params.get('offsetX') as string | null
    const offsetYParam = params.get('offsetY') as string | null
    const offsetZParam = params.get('offsetZ') as string | null
    const wheelZoomParam = params.get('wheelZoom') as string | null
    const wheelPrecisionParam = params.get('wheelPrecision') as string | null
    const wheelStartParam = params.get('wheelStart') as string | null
    const bodyShapeParam = params.get('bodyShape')
    const options = {
      contractAddress: params.get('contract')!,
      tokenId: params.get('token'),
      itemId: params.get('item'),
      skin: params.get('skin'),
      hair: params.get('hair'),
      eyes: params.get('eyes'),
      emote: params.get('emote') as PreviewEmote | null,
      camera: params.get('camera') as PreviewCamera | null,
      background: params.get('background'),
      transparentBackground: params.has('transparentBackground'),
      centerBoundingBox: params.get('centerBoundingBox') !== 'false',
      autoRotateSpeed: autoRotateSpeedParam ? parseFloat(autoRotateSpeedParam) : null,
      offsetX: offsetXParam ? parseFloat(offsetXParam) : null,
      offsetY: offsetYParam ? parseFloat(offsetYParam) : null,
      offsetZ: offsetZParam ? parseFloat(offsetZParam) : null,
      wheelZoom: wheelZoomParam ? parseFloat(wheelZoomParam) : null,
      wheelPrecision: wheelPrecisionParam ? parseFloat(wheelPrecisionParam) : null,
      wheelStart: wheelStartParam ? parseFloat(wheelStartParam) : null,
      zoom: parseZoom(params.get('zoom')),
      bodyShape:
        bodyShapeParam === 'female' || bodyShapeParam === BodyShape.FEMALE
          ? BodyShape.FEMALE
          : bodyShapeParam === 'male' || bodyShapeParam === BodyShape.MALE
          ? BodyShape.MALE
          : null,
      urns: params.getAll('urn'),
      urls: params.getAll('url'),
      base64s: params.getAll('base64'),
      profile: params.get('profile'),
      env: Object.values(PreviewEnv)
        .filter((value): value is PreviewEnv => typeof value === 'string')
        .reduce((selected, value) => (value === params.get('env') ? value : selected), PreviewEnv.PROD),
    }
    return options
  }, [search])

  // apply overrides
  const overrides = useOverrides()
  const optionsWithOverrides = useMemo(
    () => ({
      ...options,
      ...overrides,
    }),
    [options, overrides]
  )

  // return options with overrides applied (if any)
  return optionsWithOverrides
}
