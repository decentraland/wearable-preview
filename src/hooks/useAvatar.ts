import { createAvatarPreview } from '../lib/avatar'
import { useAsync } from './useAsync'
import { useOptions } from './useOptions'

export function useAvatar() {
  const options = useOptions()
  const [avatar, isLoading, error] = useAsync(() => createAvatarPreview(options), [options])
  return [avatar, isLoading, error] as const
}
