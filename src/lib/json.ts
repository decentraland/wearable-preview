export async function json<T>(url: string) {
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(await resp.text())
  }
  return resp.json() as Promise<T>
}
