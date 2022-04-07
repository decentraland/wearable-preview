import { createConfig } from '../lib/config'
import { useAsync } from './useAsync'
import { useOptions } from './useOptions'

export function useConfig() {
  const options = useOptions()
  const [avatar, isLoading, error] = useAsync(() => createConfig(options), [options])
  return [avatar, isLoading, error] as const
}
