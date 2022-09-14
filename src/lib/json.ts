import { sleep } from './sleep'

export async function json<T>(url: string, options: RequestInit = {}, attempts = 3): Promise<T> {
  try {
    const resp = await fetch(url, options)
    if (!resp.ok) {
      throw new Error(await resp.text())
    }
    return resp.json() as Promise<T>
  } catch (error) {
    if (attempts > 0) {
      await sleep(100)
      return json(url, options, attempts - 1)
    } else {
      throw error
    }
  }
}
