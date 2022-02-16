import { useMemo } from 'react'
import { AvatarPreview, AvatarPreviewOptions, createAvatarPreview } from '../lib/avatar'
import { useFetch } from './useFetch'

export function useAvatar(options: AvatarPreviewOptions, overrides: Partial<AvatarPreview> = {}) {
  const [avatar, isLoading, error] = useFetch(async () => createAvatarPreview(options))
  const avatarWithOverrides = useMemo(() => {
    const keysToOverride = (Object.keys(overrides) as (keyof AvatarPreview)[]).filter(
      (key) => typeof overrides[key] !== 'undefined' && overrides[key] !== null
    )
    if (avatar && keysToOverride.length > 0) {
      const newAvatar: AvatarPreview = { ...avatar }
      for (const key of keysToOverride) {
        const value = overrides[key]
        if (value) {
          newAvatar[key] = value as never
        }
      }
      return newAvatar
    }
    return avatar
  }, [avatar, overrides])

  return [avatarWithOverrides, isLoading, error] as const
}
