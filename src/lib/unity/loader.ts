declare function createUnityInstance(
  canvas: HTMLCanvasElement,
  config: {
    dataUrl: string
    frameworkUrl: string
    codeUrl: string
    streamingAssetsUrl?: string
    companyName?: string
    productName?: string
    productVersion?: string
    matchWebGLToCanvasSize?: boolean
    arguments?: string[]
    symbolUrl?: string
  },
): Promise<any>

// cache unity loader promises to prevent multiple loads
const unityLoaderCache = new Map<string, Promise<HTMLScriptElement>>()

const joinUrls = (baseUrl: string, path: string): string => {
  if (!baseUrl) return path

  if (!path) return baseUrl

  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  const cleanPath = path.replace(/^\//, '')

  return `${cleanBaseUrl}/${cleanPath}`
}

function loadUnityLoaderScript(src: string): Promise<HTMLScriptElement> {
  if (unityLoaderCache.has(src)) {
    return unityLoaderCache.get(src)!
  }

  const promise = new Promise<HTMLScriptElement>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(existingScript))
      existingScript.addEventListener('error', (e) => reject(e))
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve(script)
    script.onerror = (e) => reject(e)
    document.body.appendChild(script)
  })

  unityLoaderCache.set(src, promise)
  return promise
}

export const loadUnityInstance = async (
  canvas: HTMLCanvasElement,
  src: string,
  dataUrl: string,
  frameworkUrl: string,
  codeUrl: string,
  symbolUrl: string,
  streamingAssetsUrl: string,
  companyName: string,
  productName: string,
  productVersion: string,
  matchWebGLToCanvasSize: boolean,
  args: string[],
): Promise<any> => {
  try {
    const baseUrl = process.env.VITE_BASE_URL || ''
    await loadUnityLoaderScript(joinUrls(baseUrl, src))

    return await createUnityInstance(canvas, {
      dataUrl: joinUrls(baseUrl, dataUrl),
      frameworkUrl: joinUrls(baseUrl, frameworkUrl),
      codeUrl: joinUrls(baseUrl, codeUrl),
      streamingAssetsUrl: joinUrls(baseUrl, streamingAssetsUrl),
      symbolUrl: joinUrls(baseUrl, symbolUrl),
      companyName,
      productName,
      productVersion,
      matchWebGLToCanvasSize,
      arguments: args,
    })
  } catch (error) {
    console.error('❌ Failed to load Unity instance:', error)
    throw error
  }
}
