import { createConfig } from '../lib/config'
import { useAsync } from './useAsync'
import { useOptions } from './useOptions'

export function useConfig() {
  const options = useOptions()
  const [config, isLoading, error] = useAsync('useConfig', () => createConfig(options), [options])
  return [config, isLoading, error] as const
}
