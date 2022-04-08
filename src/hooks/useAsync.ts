import { useEffect, useState } from 'react'

export function useAsync<T>(asyncFunction: (...args: any[]) => Promise<T>, deps: React.DependencyList = []) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setIsLoading(true)
    asyncFunction()
      .then((result) => setResult(result))
      .catch((error) => setError(error.message))
      .finally(() => setIsLoading(false))
  }, deps) // eslint-disable-line
  return [result, isLoading, error] as const
}
