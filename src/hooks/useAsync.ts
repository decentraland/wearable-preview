import { useEffect, useState } from 'react'

/* 
 ids and nonces are used to identity the order on which async functions are called, 
 to avoid race conditions and always keep the value of the last function call, 
 regardless of the order in which they resolve 
*/
const nonces: Record<string, number> = {}
function isValid(id: string, nonce: number) {
  return nonce === nonces[id]
}

export function useAsync<T>(id: string, asyncFunction: (...args: any[]) => Promise<T>, deps: React.DependencyList = []) {
  // initialize state
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState('')

  // initialize nonce for this id
  if (typeof nonces[id] === 'undefined') {
    nonces[id] = 0
  }

  // run async function
  useEffect(() => {
    const nonce = ++nonces[id]
    setIsLoading(true)
    asyncFunction()
      .then((result) => {
        if (isValid(id, nonce)) {
          setResult(result)
        }
      })
      .catch((error) => {
        if (isValid(id, nonce)) {
          setError(error.message)
        }
      })
      .finally(() => {
        if (isValid(id, nonce)) {
          setIsLoading(false)
        }
      })
  }, deps) // eslint-disable-line

  return [result, isLoading, error] as const
}
