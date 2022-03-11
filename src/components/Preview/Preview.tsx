import React, { useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { WearableBodyShape } from '@dcl/schemas'
import { useWindowSize } from '../../hooks/useWindowSize'
import { useAvatar } from '../../hooks/useAvatar'
import { MessageType, sendMessage } from '../../lib/message'
import { AvatarCamera, AvatarEmote, AvatarPreview, AvatarPreviewType } from '../../lib/avatar'
import { parseZoom } from '../../lib/zoom'
import { Env } from '../../types/env'
import './Preview.css'
import { render } from '../../lib/babylon/render'

const Preview: React.FC = () => {
  const [previewError, setPreviewError] = useState('')
  const { width, height } = useWindowSize()
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const params = new URLSearchParams(window.location.search)
  const contractAddress = params.get('contract')!
  const tokenId = params.get('token')
  const itemId = params.get('item')
  const skin = params.get('skin')
  const hair = params.get('hair')
  const eyes = params.get('eyes')
  const emote = params.get('emote') as AvatarEmote | null
  const camera = params.get('camera') as AvatarCamera | null
  const transparentBackground = params.has('transparentBackground')
  const autoRotateSpeedParam = params.get('autoRotateSpeed') as string | null
  const autoRotateSpeed = autoRotateSpeedParam ? parseFloat(autoRotateSpeedParam) : null
  const offsetXParam = params.get('offsetX') as string | null
  const offsetX = offsetXParam ? parseFloat(offsetXParam) : null
  const offsetYParam = params.get('offsetY') as string | null
  const offsetY = offsetYParam ? parseFloat(offsetYParam) : null
  const offsetZParam = params.get('offsetZ') as string | null
  const offsetZ = offsetZParam ? parseFloat(offsetZParam) : null
  const zoom = parseZoom(params.get('zoom'))
  const bodyShapeParam = params.get('bodyShape') || params.get('shape') // keep supporting deprecated "shape" param to avoid breaking changes
  const bodyShape = bodyShapeParam === 'female' ? WearableBodyShape.FEMALE : bodyShapeParam === 'male' ? WearableBodyShape.MALE : null
  const urns = params.getAll('urn')
  const profile = params.get('profile')
  const env = Object.values(Env).reduce((selected, value) => (value === params.get('env') ? value : selected), Env.PROD)
  const [overrides, setOverrides] = useState<Partial<AvatarPreview>>({})
  const [avatar, isLoadingAvatar, avatarError] = useAvatar(
    {
      contractAddress,
      tokenId,
      itemId,
      bodyShape,
      urns,
      env,
      profile,
      skin,
      hair,
      eyes,
      zoom,
      emote,
      camera,
      autoRotateSpeed,
      offsetX,
      offsetY,
      offsetZ,
    },
    overrides
  )
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
      setStyle({ backgroundImage: transparentBackground ? undefined : avatar.background.gradient, opacity: 1 })

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

  // receive message from parent window to update options
  useEffect(() => {
    const previous = window.onmessage
    window.onmessage = function (event: MessageEvent) {
      if (event.data && event.data.type === MessageType.UPDATE) {
        const message = event.data as { type: MessageType.UPDATE; options: Partial<AvatarPreview> }
        if (message.options && typeof message.options === 'object') {
          setOverrides(message.options)
        }
      }
    }
    return () => {
      window.onmessage = previous
    }
  }, [])

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
