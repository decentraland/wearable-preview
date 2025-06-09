declare function createUnityInstance(
  canvas: HTMLCanvasElement,
  config: {
    dataUrl: string
    frameworkUrl: string
    codeUrl: string
    symbolsUrl: string
    streamingAssetsUrl?: string
    companyName?: string
    productName?: string
    productVersion?: string
    matchWebGLToCanvasSize?: boolean
    arguments?: string[]
  },
): Promise<any>

export const loadUnityInstance = (
  canvas: HTMLCanvasElement,
  src: string,
  dataUrl: string,
  frameworkUrl: string,
  codeUrl: string,
  symbolsUrl: string,
  streamingAssetsUrl: string,
  companyName: string,
  productName: string,
  productVersion: string,
  matchWebGLToCanvasSize: boolean,
  args: string[],
) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    ;(script.src = src),
      (script.onload = () => {
        createUnityInstance(canvas, {
          dataUrl: dataUrl,
          frameworkUrl: frameworkUrl,
          codeUrl: codeUrl,
          symbolsUrl: symbolsUrl,
          streamingAssetsUrl: streamingAssetsUrl,
          companyName: companyName,
          productName: productName,
          productVersion: productVersion,
          matchWebGLToCanvasSize: matchWebGLToCanvasSize,
          arguments: args,
        })
          .then((unityInstance) => {
            console.log('✅ Unity loaded')
            resolve(unityInstance)
          })
          .catch((error) => {
            console.error('❌ Unity load failed', error)
            reject(error)
          })
      })
    script.onerror = (e) => {
      console.error('❌ Failed to load Unity loader script', e)
      reject(e)
    }
    document.body.appendChild(script)
  })
}
