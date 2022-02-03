import React, { useEffect, useRef, useState } from 'react'
import { Rarity, WearableBodyShape } from '@dcl/schemas'
import classNames from 'classnames'
import { getZoom, preview } from '../../lib/babylon'
import { getRepresentation, isTexture } from '../../lib/representation'
import { useWearable } from '../../hooks/useWearable'
import { useWindowSize } from '../../hooks/useWindowSize'
import { MessageType, sendMessage } from '../../lib/message'
import { Env } from '../../types/env'
import './Preview.css'
import { useWearables } from '../../hooks/useWearables'

const urns = [
  'urn:decentraland:off-chain:base-avatars:sport_blue_shoes',
  'urn:decentraland:off-chain:base-avatars:f_stripe_long_skirt',
  'urn:decentraland:off-chain:base-avatars:f_eyebrows_04',
  'urn:decentraland:off-chain:base-avatars:f_eyes_01',
  'urn:decentraland:off-chain:base-avatars:f_mouth_00',
  'urn:decentraland:off-chain:base-avatars:striped_top',
  'urn:decentraland:off-chain:base-avatars:short_hair',
]

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
  const shape = params.get('shape') === 'female' ? WearableBodyShape.FEMALE : WearableBodyShape.MALE
  const env = Object.values(Env).reduce((selected, value) => (value === params.get('env') ? value : selected), Env.PROD)
  const [wearable, isLoadingWearable, wearableError] = useWearable({ contractAddress, tokenId, itemId, env })
  const [wearables, isLoadingWearables, wearablesError] = useWearables({ urns, env })
  const [image, setImage] = useState('')
  const [is3D, setIs3D] = useState(true)
  const [isMessageSent, setIsMessageSent] = useState(false)

  const error = previewError || wearableError || wearablesError
  const isLoading = (isLoadingModel || isLoadingWearable || isLoadingWearables) && !error
  const showImage = !!image && !is3D && !isLoading
  const showCanvas = is3D && !isLoading

  useEffect(() => {
    if (canvasRef.current && wearable && wearables) {
      // rarity background
      const [light, dark] = Rarity.getGradient(wearable.rarity)
      const backgroundImage = `radial-gradient(${light}, ${dark})`
      setStyle({ backgroundImage, opacity: 1 })

      // set background image
      setImage(wearable.thumbnail)

      // load model or image (for texture only wearables)
      let representation = getRepresentation(wearable)
      if (isTexture(representation)) {
        setIs3D(false)
        setIsLoadingModel(false)
        setIsLoaded(true)
      } else {
        // preview models
        preview(canvasRef.current, [wearables[0], wearables[5]], {
          zoom: getZoom(wearable.data.category),
          skin: skin ? '#' + skin : undefined,
          hair: hair ? '#' + hair : undefined,
          shape,
        })
          .catch((error) => setPreviewError(error.message))
          .finally(() => {
            setIsLoadingModel(false)
            setIsLoaded(true)
          })
      }
    }
  }, [canvasRef.current, wearable, wearables]) // eslint-disable-line

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
        'is-3d': is3D,
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
