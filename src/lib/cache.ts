interface IMemo<T> {
  memo: (key: string, fn: (...args: any[]) => Promise<T>, ...args: any[]) => Promise<T>
  reset: () => void
}

export function createMemo<T>(): IMemo<T> {
  const cache: Record<string, Promise<T>> = {}
  return {
    memo: async (key, fn, ...args) => {
      const exists = key in cache
      if (!exists) {
        cache[key] = fn(...args)
      }
      return cache[key]
    },
    reset: () => {
      for (const key in cache) {
        delete cache[key]
      }
    },
  }
}
