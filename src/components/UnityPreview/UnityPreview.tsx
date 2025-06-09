import React, { useEffect, useRef, useState } from 'react'
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
  const [previewError, setPreviewError] = useState('')
  const { width, height } = useWindowSize()
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const unityInstanceRef = useRef<any>(null)
  const controller = useController()
  const [config, isLoadingConfig, configError] = useConfig()
  const [image, setImage] = useState('')
  const [is3D, setIs3D] = useState(true)
  const [isMessageSent, setIsMessageSent] = useState(false)

  const error = previewError || configError
  const isLoading = (isLoadingModel || isLoadingConfig) && !error
  const showImage = !!image && !is3D && !isLoading
  const showCanvas = is3D && !isLoading

  useEffect(() => {
    if (canvasRef.current && config) {
      let style: React.CSSProperties = { opacity: 1 } // fade in effect

      // Initialize Unity instance
      loadUnityInstance(
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
        .then((unityInstance) => {
          unityInstanceRef.current = unityInstance
          setIsLoadingModel(false)
          setIsLoaded(true)
        })
        .catch((error) => {
          console.error('Unity failed to load:', error)
          setPreviewError(error.message)
          setIsLoadingModel(false)
        })

      // set background image
      if (config.background.image) {
        setImage(config.background.image)
        style.opacity = 1
        if (!config.background.transparent && config.type === PreviewType.TEXTURE) {
          style.backgroundColor = config.background.color
        }
      }

      setStyle(style)

      // load model or image (for texture only wearables)
      if (config.type === PreviewType.TEXTURE) {
        setIs3D(false)
        setIsLoadingModel(false)
        setIsLoaded(true)
      }
    }

    return () => {
      // Cleanup Unity instance on unmount
      if (unityInstanceRef.current) {
        unityInstanceRef.current.Quit()
        unityInstanceRef.current = null
      }
    }
  }, [canvasRef.current, config])

  // send a message to the parent window when loaded or error occurs
  useEffect(() => {
    if (!isMessageSent) {
      if (isLoaded) {
        sendMessage(getParent(), PreviewMessageType.LOAD, null)
        setIsMessageSent(true)
        if (config?.type === PreviewType.AVATAR || (config?.emote && config.emote !== PreviewEmote.IDLE)) {
          // Handle emote playback through Unity instance if needed
          unityInstanceRef.current?.SendMessage('AvatarController', 'PlayEmote', config.emote)
        }
      } else if (error) {
        sendMessage(getParent(), PreviewMessageType.ERROR, { message: error })
        setIsMessageSent(true)
      }
    }
  }, [isLoaded, error, isMessageSent, config?.type, config?.emote])

  // when the config is being loaded again reset all the other loading flags
  useEffect(() => {
    if (isLoadingConfig) {
      let shouldResetIsLoaded = false
      if (!isLoadingModel) {
        setIsLoadingModel(true)
        shouldResetIsLoaded = true
      }
      if (isMessageSent) {
        setIsMessageSent(false)
        shouldResetIsLoaded = true
      }
      if (shouldResetIsLoaded && isLoaded) {
        setIsLoaded(false)
      }
    }
  }, [isLoadingConfig, isLoadingModel, isMessageSent, isLoaded])

  // send ready message to parent
  useReady()

  return (
    <div
      className={classNames('Preview', {
        'is-dragging': isDragging,
        'is-loading': isLoading,
        'is-loaded': isLoaded,
        'is-3d': is3D && config?.camera === PreviewCamera.INTERACTIVE,
        'has-error': !!error,
        'no-fade-effect': config && !config.fadeEffect,
      })}
      style={style}
    >
      <img
        src={image}
        className={classNames('thumbnail', {
          'is-visible': showImage,
        })}
        alt="preview"
      />
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        className={classNames({
          'is-visible': showCanvas,
        })}
        width={width}
        height={height}
        onMouseDown={() => setIsDragging(is3D && !error)}
        onMouseUp={() => setIsDragging(false)}
      ></canvas>
      {error && <div className="error">{error}</div>}
    </div>
  )
}

export default React.memo(UnityPreview)
