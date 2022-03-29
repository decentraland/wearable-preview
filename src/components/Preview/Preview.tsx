import React, { useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { useWindowSize } from '../../hooks/useWindowSize'
import { useAvatar } from '../../hooks/useAvatar'
import { MessageType, sendMessage } from '../../lib/message'
import { AvatarCamera, AvatarPreviewType } from '../../lib/avatar'
import { render } from '../../lib/babylon/render'
import './Preview.css'

const Preview: React.FC = () => {
  const [previewError, setPreviewError] = useState('')
  const { width, height } = useWindowSize()
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [avatar, isLoadingAvatar, avatarError] = useAvatar()
  const [image, setImage] = useState('')
  const [is3D, setIs3D] = useState(true)
  const [isMessageSent, setIsMessageSent] = useState(false)

  const error = previewError || avatarError
  const isLoading = (isLoadingModel || isLoadingAvatar) && !error
  const showImage = !!image && !is3D && !isLoading
  const showCanvas = is3D && !isLoading

  useEffect(() => {
    if (canvasRef.current && avatar) {
      // rarity background
      setStyle({ backgroundImage: avatar.background.gradient ? avatar.background.gradient : undefined, opacity: 1 })

      // set background image
      if (avatar.background.image) {
        setImage(avatar.background.image)
      }

      // load model or image (for texture only wearables)
      if (avatar.type === AvatarPreviewType.TEXTURE) {
        setIs3D(false)
        setIsLoadingModel(false)
        setIsLoaded(true)
      } else {
        // preview models
        render(canvasRef.current, avatar)
          .catch((error) => setPreviewError(error.message))
          .finally(() => {
            setIsLoadingModel(false)
            setIsLoaded(true)
          })
      }
    }
  }, [canvasRef.current, avatar]) // eslint-disable-line

  // send a mesasge to the parent window when loaded or error occurs
  useEffect(() => {
    if (!isMessageSent) {
      if (isLoaded) {
        sendMessage(MessageType.LOAD)
        setIsMessageSent(true)
      } else if (error) {
        sendMessage(MessageType.ERROR, error)
        setIsMessageSent(true)
      }
    }
  }, [isLoaded, error, isMessageSent])

  return (
    <div
      className={classNames('Preview', {
        'is-dragging': isDragging,
        'is-loading': isLoading,
        'is-loaded': isLoaded,
        'is-3d': is3D && avatar?.camera === AvatarCamera.INTERACTIVE,
        'has-error': !!error,
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
