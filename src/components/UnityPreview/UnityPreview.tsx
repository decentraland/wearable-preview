import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import { PreviewCamera, PreviewType, PreviewMessageType, sendMessage } from '@dcl/schemas'

import { useWindowSize } from '../../hooks/useWindowSize'
import { useUnityConfig } from '../../hooks/useUnityConfig'
import { useReady } from '../../hooks/useReady'
import { useController } from '../../hooks/useController'
import { getParent } from '../../lib/parent'
import { render } from '../../lib/unity/render'

import './UnityPreview.css'

let unityInitialized = false

const UnityPreview: React.FC = () => {
  const { width = window.innerWidth, height = window.innerHeight } = useWindowSize()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const unityInstanceRef = useRef<any>(null)
  const initializingRef = useRef(false)

  const [pixelRatio, setPixelRatio] = useState(() => window.devicePixelRatio || 1)

  const controller = useController()
  const [config, isLoadingConfig, configError] = useUnityConfig()

  const [previewError, setPreviewError] = useState('')
  const [is3D, setIs3D] = useState(true)
  const [image, setImage] = useState('')
  const [isLoaded, setIsLoaded] = useState(false)

  const error = previewError || configError
  const isLoading = (isLoadingConfig || !isLoaded) && !error
  const showImage = !!image && !is3D && !isLoading
  const showCanvas = is3D && !isLoading

  const onLoaded = useCallback(
    (event: MessageEvent) => {
      if (event.data.type === 'unity-renderer') {
        const { type, payload } = event.data.payload
        if (type === 'loaded' && (payload === true || payload === 'true')) {
          setIsLoaded(true)
          sendMessage(getParent(), PreviewMessageType.LOAD, null)
        }
      }
    },
    [config, controller, unityInstanceRef, setIsLoaded],
  )

  useEffect(() => {
    if (unityInitialized || isLoadingConfig || !config) return

    const init = async () => {
      if (!canvasRef.current || initializingRef.current || unityInstanceRef.current) return
      initializingRef.current = true

      try {
        setIsLoaded(false)
        const { unity, scene, emote } = await render(canvasRef.current)
        unityInstanceRef.current = unity
        controller.current = { scene, emote }
        window.addEventListener('message', onLoaded, false)
        unityInitialized = true
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load Unity'
        console.error('Unity init failed:', err)
        setPreviewError(errorMessage)
        sendMessage(getParent(), PreviewMessageType.ERROR, { message: errorMessage })
      } finally {
        initializingRef.current = false
      }
    }

    init()

    return () => {
      window.removeEventListener('message', onLoaded, false)

      if (unityInstanceRef.current) {
        unityInstanceRef.current.Quit?.()
        unityInstanceRef.current = null
      }
    }
  }, [config, isLoadingConfig, setIsLoaded])

  useEffect(() => {
    if (!config) return

    if (config.background.image) {
      setImage(config.background.image)
    }

    if (config.type === PreviewType.TEXTURE) {
      setIs3D(false)
    }
  }, [config])

  useEffect(() => {
    const handlePixelRatioChange = () => {
      const newPixelRatio = window.devicePixelRatio || 1
      setPixelRatio(newPixelRatio)
    }

    const mediaQuery = window.matchMedia(`(resolution: ${pixelRatio}dppx)`)
    mediaQuery.addEventListener('change', handlePixelRatioChange)

    return () => {
      mediaQuery.removeEventListener('change', handlePixelRatioChange)
    }
  }, [pixelRatio])

  useReady()

  const style = useMemo(
    () => ({
      opacity: 1,
      backgroundColor:
        !config?.background.transparent && config?.type === PreviewType.TEXTURE ? config.background.color : undefined,
    }),
    [config],
  )

  const canvasStyle = useMemo(
    () => ({
      width: `${width}px`,
      height: `${height}px`,
    }),
    [width, height],
  )

  return (
    <div
      className={classNames('Preview', {
        'is-loading': isLoading,
        'is-loaded': isLoaded,
        'is-3d': is3D && config?.camera === PreviewCamera.INTERACTIVE,
        'has-error': !!error,
        'no-fade-effect': config && !config.fadeEffect,
      })}
      style={style}
    >
      <img src={image} className={classNames('thumbnail', { 'is-visible': showImage })} alt="preview" />
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        className={classNames({ 'is-visible': showCanvas })}
        width={Math.round(width * pixelRatio)}
        height={Math.round(height * pixelRatio)}
        style={canvasStyle}
      />
      {error && <div className="error">{error}</div>}
    </div>
  )
}

export default React.memo(UnityPreview)
