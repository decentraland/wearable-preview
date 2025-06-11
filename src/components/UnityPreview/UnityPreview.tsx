import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import { PreviewCamera, PreviewType, PreviewMessageType, sendMessage, PreviewEmote } from '@dcl/schemas'

import { useWindowSize } from '../../hooks/useWindowSize'
import { useConfig } from '../../hooks/useConfig'
import { useReady } from '../../hooks/useReady'
import { useController } from '../../hooks/useController'
import { getParent } from '../../lib/parent'
import { loadUnityInstance } from '../../lib/unity/loader'

import './UnityPreview.css'

const UnityPreview: React.FC = () => {
  const { width = window.innerWidth, height = window.innerHeight } = useWindowSize()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const unityInstanceRef = useRef<any>(null)
  const initializingRef = useRef(false)

  const [pixelRatio, setPixelRatio] = useState(() => window.devicePixelRatio || 1)

  const controller = useController()
  const [config, isLoadingConfig, configError] = useConfig()

  const [previewError, setPreviewError] = useState('')
  const [is3D, setIs3D] = useState(true)
  const [image, setImage] = useState('')
  const [isMessageSent, setIsMessageSent] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  const error = previewError || configError
  const isLoading = (isLoadingModel || isLoadingConfig) && !error
  const showImage = !!image && !is3D && !isLoading
  const showCanvas = is3D && !isLoading

  const style = useMemo(
    () => ({
      opacity: 1,
      backgroundColor:
        !config?.background.transparent && config?.type === PreviewType.TEXTURE ? config.background.color : undefined,
    }),
    [config],
  )

  const sendUnityMessage = useCallback((target: string, method: string, value: string) => {
    try {
      unityInstanceRef.current?.SendMessage(target, method, value)
    } catch (err) {
      console.error(`Unity msg failed (${target}.${method}):`, err)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      if (!canvasRef.current || initializingRef.current || unityInstanceRef.current) return
      initializingRef.current = true
      try {
        const instance = await loadUnityInstance(
          canvasRef.current,
          '/unity/Build/aang-renderer.loader.js',
          '/unity/Build/aang-renderer.data.br',
          '/unity/Build/aang-renderer.framework.js.br',
          '/unity/Build/aang-renderer.wasm.br',
          '/unity/Build/aang-renderer.symbols.json.br',
          '/unity/StreamingAssets',
          'Decentraland',
          'AangRenderer',
          '0.1.0',
          true,
          [],
        )
        unityInstanceRef.current = instance
        setIsLoaded(true)
        setIsLoadingModel(false)
      } catch (err) {
        console.error('Unity init failed:', err)
        setPreviewError(err instanceof Error ? err.message : 'Failed to load Unity')
        setIsLoadingModel(false)
      } finally {
        initializingRef.current = false
      }
    }

    init()

    return () => {
      if (unityInstanceRef.current) {
        unityInstanceRef.current.Quit?.()
        unityInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!config) return

    if (config.background.image) {
      setImage(config.background.image)
    }

    if (config.type === PreviewType.TEXTURE) {
      setIs3D(false)
      setIsLoadingModel(false)
      setIsLoaded(true)
    }
  }, [config])

  useEffect(() => {
    if (!isMessageSent && isLoaded && config && unityInstanceRef.current) {
      sendMessage(getParent(), PreviewMessageType.LOAD, null)
      config.mode && sendUnityMessage('JSBridge', 'SetMode', config.mode.toString())
      config.background.color && sendUnityMessage('JSBridge', 'SetBackground', config.background.color.replace('#', ''))
      if (config.type === PreviewType.AVATAR && config.emote && config.emote !== PreviewEmote.IDLE) {
        sendUnityMessage('AvatarController', 'PlayEmote', config.emote.toString())
      }
      setIsMessageSent(true)
    } else if (!isMessageSent && error) {
      sendMessage(getParent(), PreviewMessageType.ERROR, { message: error })
      setIsMessageSent(true)
    }
  }, [isLoaded, error, isMessageSent, config, sendUnityMessage])

  useEffect(() => {
    if (isLoadingConfig) {
      setIsLoadingModel(true)
      setIsMessageSent(false)
      setIsLoaded(false)
    }
  }, [isLoadingConfig])

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
