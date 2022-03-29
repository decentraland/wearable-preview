import { useMemo, useState } from 'react'
import { useOverrides } from './useOverrides'

import { WearableBodyShape } from '@dcl/schemas'
import { Env } from '../types/env'
import { AvatarEmote, AvatarCamera, AvatarPreviewOptions } from '../lib/avatar'
import { parseZoom } from '../lib/zoom'

export const useOptions = () => {
  // get options from url params
  const [search] = useState(window.location.search.toString())
  const options = useMemo<AvatarPreviewOptions>(() => {
    const params = new URLSearchParams(search)
    const autoRotateSpeedParam = params.get('autoRotateSpeed') as string | null
    const offsetXParam = params.get('offsetX') as string | null
    const offsetYParam = params.get('offsetY') as string | null
    const offsetZParam = params.get('offsetZ') as string | null
    const bodyShapeParam = params.get('bodyShape')
    const options = {
      contractAddress: params.get('contract')!,
      tokenId: params.get('token'),
      itemId: params.get('item'),
      skin: params.get('skin'),
      hair: params.get('hair'),
      eyes: params.get('eyes'),
      emote: params.get('emote') as AvatarEmote | null,
      camera: params.get('camera') as AvatarCamera | null,
      transparentBackground: params.has('transparentBackground'),
      autoRotateSpeed: autoRotateSpeedParam ? parseFloat(autoRotateSpeedParam) : null,
      offsetX: offsetXParam ? parseFloat(offsetXParam) : null,
      offsetY: offsetYParam ? parseFloat(offsetYParam) : null,
      offsetZ: offsetZParam ? parseFloat(offsetZParam) : null,
      zoom: parseZoom(params.get('zoom')),
      bodyShape: bodyShapeParam === 'female' ? WearableBodyShape.FEMALE : bodyShapeParam === 'male' ? WearableBodyShape.MALE : null,
      urns: params.getAll('urn'),
      profile: params.get('profile'),
      env: Object.values(Env).reduce((selected, value) => (value === params.get('env') ? value : selected), Env.PROD),
    }
    return options
  }, [search])

  // apply overrides
  const overrides = useOverrides()
  const optionsWithOverrides = useMemo(() => {
    const keysToOverride = (Object.keys(overrides) as (keyof AvatarPreviewOptions)[]).filter(
      (key) => typeof overrides[key] !== 'undefined' && overrides[key] !== null
    )
    if (options && keysToOverride.length > 0) {
      const newOptions: AvatarPreviewOptions = { ...options }
      for (const key of keysToOverride) {
        const value = overrides[key]
        if (value) {
          newOptions[key] = value as never
        }
      }
      return newOptions
    }
    return options
  }, [options, overrides])

  // return options with overrides applied (if any)
  return optionsWithOverrides
}
