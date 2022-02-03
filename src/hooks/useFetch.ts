import { useEffect, useState } from 'react'

export function useFetch<T>(fetcher: () => Promise<T>) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setIsLoading(true)
    fetcher()
      .then((result) => setResult(result))
      .catch((error) => setError(error.message))
      .finally(() => setIsLoading(false))
  }, []) // eslint-disable-line
  return [result, isLoading, error] as const
}
