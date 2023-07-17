import React, { useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { PreviewCamera, PreviewType, PreviewMessageType, sendMessage, PreviewEmote } from '@dcl/schemas'
import { useWindowSize } from '../../hooks/useWindowSize'
import { useConfig } from '../../hooks/useConfig'
import { useReady } from '../../hooks/useReady'
import { useController } from '../../hooks/useController'
import { render } from '../../lib/babylon/render'
import { handleEmoteEvents } from '../../lib/emote-events'
import { getParent } from '../../lib/parent'
import './Preview.css'

const Preview: React.FC = () => {
  const [previewError, setPreviewError] = useState('')
  const { width, height } = useWindowSize()
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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

      // set background image
      if (config.background.image) {
        setImage(config.background.image)
        style.opacity = 1
        // if rendering a texture, babylon won't render the background, so we do it by css
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
      } else {
        // preview models
        render(canvasRef.current, config)
          .then((newController) => {
            // set new controller as current one
            controller.current = newController
            // handle emote events and forward them as messages
            handleEmoteEvents(controller.current)
          })
          .catch((error) => setPreviewError(error.message))
          .finally(() => {
            setIsLoadingModel(false)
            setIsLoaded(true)
          })
      }
    }
  }, [canvasRef.current, config]) // eslint-disable-line

  // send a mesasge to the parent window when loaded or error occurs
  useEffect(() => {
    if (!isMessageSent) {
      if (isLoaded) {
        sendMessage(getParent(), PreviewMessageType.LOAD, null)
        setIsMessageSent(true)
        if (config?.type === PreviewType.AVATAR || (config?.emote && config.emote !== PreviewEmote.IDLE)) {
          controller.current?.emote.play()
        }
      } else if (error) {
        sendMessage(getParent(), PreviewMessageType.ERROR, { message: error })
        setIsMessageSent(true)
      }
    }
  }, [isLoaded, error, isMessageSent, controller, config?.type, config?.emote])

  // when the config is being loaded again (because the was an update to some of the options) reset all the other loading flags
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
        id="wearable-preview"
        className={classNames({
          'is-visible': showCanvas,
        })}
        width={width}
        height={height}
        ref={canvasRef}
        onMouseDown={() => setIsDragging(is3D && !error)}
        onMouseUp={() => setIsDragging(false)}
      ></canvas>
      {error && <div className="error">{error}</div>}
    </div>
  )
}

export default React.memo(Preview)
