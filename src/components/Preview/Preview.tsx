import React, { useEffect, useRef, useState } from 'react'
import { Rarity } from '@dcl/schemas'
import classNames from 'classnames'
import { loadWearable } from '../../lib/babylon'
import { useWearable } from '../../hooks/useWearable'
import { useWindowSize } from '../../hooks/useWindowSize'
import { Env } from '../../types/env'
import './Preview.css'
import { MessageType, sendMessage } from '../../lib/message'

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
  const env = Object.values(Env).reduce((selected, value) => (value === params.get('env') ? value : selected), Env.PROD)
  const [wearable, isLoadingWearable, wearableError] = useWearable({ contractAddress, tokenId, itemId, env })
  const [image, setImage] = useState('')
  const [is3D, setIs3D] = useState(true)
  const [isMessageSent, setIsMessageSent] = useState(false)

  const error = previewError || wearableError
  const isLoading = (isLoadingModel || isLoadingWearable) && !error
  const showImage = !!image && !is3D && !isLoading
  const showCanvas = is3D && !isLoading

  useEffect(() => {
    if (canvasRef.current && wearable) {
      // rarity background
      const [light, dark] = Rarity.getGradient(wearable.rarity)
      const backgroundImage = `radial-gradient(${light}, ${dark})`
      setStyle({ backgroundImage, opacity: 1 })

      // set background image
      setImage(wearable.thumbnail)

      // load model or image (for texture only wearables)
      const representation = wearable.data.representations[0]
      if (representation.mainFile.endsWith('png')) {
        setIs3D(false)
        setIsLoadingModel(false)
        setIsLoaded(true)
      } else {
        // load model
        const content = representation.contents.find((content) => content.key === representation.mainFile)
        const mappings = representation.contents.reduce((obj, file) => {
          obj[file.key] = file.url
          return obj
        }, {} as Record<string, string>)
        if (content) {
          loadWearable(canvasRef.current, content.url, mappings, wearable.data.category)
            .catch((error) => setPreviewError(error.message))
            .finally(() => {
              setIsLoadingModel(false)
              setIsLoaded(true)
            })
        } else {
          console.warn('Content not found for wearable', wearable)
          setPreviewError('Content not found')
        }
      }
    }
  }, [canvasRef.current, wearable])

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
