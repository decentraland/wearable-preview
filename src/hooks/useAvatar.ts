import { AvatarPreviewOptions, createAvatarPreview } from '../lib/avatar'
import { useFetch } from './useFetch'

export function useAvatar(options: AvatarPreviewOptions) {
  const [avatar, isLoading, error] = useFetch(async () => createAvatarPreview(options))
  return [avatar, isLoading, error] as const
}
