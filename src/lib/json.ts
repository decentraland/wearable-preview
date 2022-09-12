import { sleep } from './sleep'

export async function json<T>(
  url: string | ((_fetch: typeof fetch) => ReturnType<typeof fetch>),
  attempts = 3
): Promise<T> {
  try {
    const resp = typeof url === 'string' ? await fetch(url) : await url(fetch)
    if (!resp.ok) {
      throw new Error(await resp.text())
    }
    return resp.json() as Promise<T>
  } catch (error) {
    if (attempts > 0) {
      await sleep(100)
      return json(url, attempts - 1)
    } else {
      throw error
    }
  }
}
