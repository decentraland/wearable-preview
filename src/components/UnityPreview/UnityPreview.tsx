import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import { PreviewType, PreviewMessageType, sendMessage, PreviewRenderer } from '@dcl/schemas'

import { sendIndividualOverrideMessages } from '../../lib/unity/messages'
import { getParent } from '../../lib/parent'
import { render } from '../../lib/unity/render'
import { getRandomDefaultProfile } from '../../lib/profile'
import { useWindowSize } from '../../hooks/useWindowSize'
import { useUnityConfig } from '../../hooks/useUnityConfig'
import { useReady } from '../../hooks/useReady'
import { useController } from '../../hooks/useController'
import { useOptions } from '../../hooks/useOptions'

import './UnityPreview.css'

// Constants
const UNITY_MESSAGE_TYPE = 'unity-renderer'
const UNITY_CANVAS_ID = 'unity-canvas'
const DEFAULT_PIXEL_RATIO = 1
const DEFAULT_ERROR_MESSAGE = 'Failed to load Unity'

// Types
interface UnityRenderingState {
  isLoaded: boolean
  isInitialized: boolean
  error: string | null
}

interface UnityRefs {
  canvas: React.RefObject<HTMLCanvasElement>
  unityInstance: React.MutableRefObject<any>
  isInitializing: React.MutableRefObject<boolean>
  lastSentOverrides: React.MutableRefObject<Record<string, any>>
}

interface PreviewState {
  pixelRatio: number
  is3D: boolean
  backgroundImage: string
}

// Custom hook for Unity initialization and state management
const useUnityRenderer = (
  refs: UnityRefs,
  controller: ReturnType<typeof useController>,
  config: ReturnType<typeof useUnityConfig>[0],
  isLoadingConfig: boolean,
): UnityRenderingState => {
  const [renderingState, setRenderingState] = useState<UnityRenderingState>({
    isLoaded: false,
    isInitialized: false,
    error: null,
  })

  const handleUnityLoaded = useCallback((event: MessageEvent) => {
    if (event.data.type === UNITY_MESSAGE_TYPE) {
      const { type, payload } = event.data.payload
      if (type === 'loaded' && (payload === true || payload === 'true')) {
        setRenderingState((prev) => ({
          ...prev,
          isLoaded: true,
          isInitialized: true,
        }))
        sendMessage(getParent(), PreviewMessageType.LOAD, { renderer: PreviewRenderer.UNITY })
      }
    }
  }, [])

  const initializeUnity = useCallback(async () => {
    if (!refs.canvas.current || refs.isInitializing.current || refs.unityInstance.current) {
      return
    }

    refs.isInitializing.current = true
    setRenderingState((prev) => ({ ...prev, isLoaded: false, error: null }))

    try {
      const { unity, scene, emote } = await render(refs.canvas.current)
      refs.unityInstance.current = unity
      controller.current = { scene, emote }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : DEFAULT_ERROR_MESSAGE
      console.error('Unity init failed:', err)
      setRenderingState((prev) => ({ ...prev, error: errorMessage }))
      sendMessage(getParent(), PreviewMessageType.ERROR, { message: errorMessage })
    } finally {
      refs.isInitializing.current = false
    }
  }, [refs, controller])

  // Separate effect for Unity initialization
  useEffect(() => {
    if (renderingState.isInitialized || isLoadingConfig || !config) {
      return
    }

    initializeUnity()
  }, [config, isLoadingConfig, renderingState.isInitialized, initializeUnity])

  // Separate effect for event listener management - always listening when config is available
  useEffect(() => {
    if (!config) {
      return
    }

    window.addEventListener('message', handleUnityLoaded, false)

    return () => {
      window.removeEventListener('message', handleUnityLoaded, false)
    }
  }, [config, handleUnityLoaded])

  return renderingState
}

// Custom hook for preview state management
const usePreviewState = (config: ReturnType<typeof useUnityConfig>[0]): PreviewState => {
  const [previewState, setPreviewState] = useState<PreviewState>({
    pixelRatio: window.devicePixelRatio || DEFAULT_PIXEL_RATIO,
    is3D: true,
    backgroundImage: '',
  })

  // Handle pixel ratio changes
  useEffect(() => {
    const handlePixelRatioChange = () => {
      setPreviewState((prev) => ({
        ...prev,
        pixelRatio: window.devicePixelRatio || DEFAULT_PIXEL_RATIO,
      }))
    }

    const mediaQuery = window.matchMedia(`(resolution: ${previewState.pixelRatio}dppx)`)
    mediaQuery.addEventListener('change', handlePixelRatioChange)

    return () => {
      mediaQuery.removeEventListener('change', handlePixelRatioChange)
    }
  }, [previewState.pixelRatio])

  // Handle config changes
  useEffect(() => {
    if (!config) return

    setPreviewState((prev) => ({
      ...prev,
      backgroundImage: config.background.image || '',
      is3D: config.type !== PreviewType.TEXTURE,
    }))
  }, [config])

  return previewState
}

// Custom hook for Unity overrides management
const useUnityOverrides = (
  unityInstance: React.MutableRefObject<any>,
  lastSentOverrides: React.MutableRefObject<Record<string, any>>,
  renderingState: UnityRenderingState,
  options: ReturnType<typeof useOptions>['options'],
  overrideSources: ReturnType<typeof useOptions>['overrideSources'],
): void => {
  const overridesData = useMemo(() => {
    const allOverrides: Record<string, any> = {}

    for (const key of Object.keys(overrideSources)) {
      if (overrideSources[key] && options[key as keyof typeof options] !== undefined) {
        allOverrides[key] = options[key as keyof typeof options]
      }
    }

    return allOverrides
  }, [overrideSources, options])

  useEffect(() => {
    if (!renderingState.isInitialized || !renderingState.isLoaded || !unityInstance.current) {
      return
    }

    if (overridesData.profile === 'default') {
      const previousProfile = lastSentOverrides.current.profile
      overridesData.profile = previousProfile?.match(/^default\d+$/) ? previousProfile : getRandomDefaultProfile()
    }

    if (Object.keys(overridesData).length > 0) {
      sendIndividualOverrideMessages(unityInstance.current, overridesData, overrideSources)
      lastSentOverrides.current = overridesData
    }
  }, [
    renderingState.isInitialized,
    renderingState.isLoaded,
    overridesData,
    overrideSources,
    unityInstance,
    lastSentOverrides,
  ])
}

const UnityPreview: React.FC = () => {
  const { width = window.innerWidth, height = window.innerHeight } = useWindowSize()

  // Initialize refs (must be called in the same order every time)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const unityInstanceRef = useRef<any>(null)
  const isInitializingRef = useRef(false)
  const lastSentOverridesRef = useRef<Record<string, any>>({})

  // Hooks
  const controller = useController()
  const [config, isLoadingConfig, configError] = useUnityConfig()
  const { options, overrideSources } = useOptions()

  // Create refs object after all refs are created
  const refs: UnityRefs = useMemo(
    () => ({
      canvas: canvasRef,
      unityInstance: unityInstanceRef,
      isInitializing: isInitializingRef,
      lastSentOverrides: lastSentOverridesRef,
    }),
    [],
  )

  // Custom hooks
  const renderingState = useUnityRenderer(refs, controller, config, isLoadingConfig)
  const previewState = usePreviewState(config)

  // Unity overrides effect
  useUnityOverrides(refs.unityInstance, refs.lastSentOverrides, renderingState, options, overrideSources)

  // Mark as ready
  useReady()

  // Computed values
  const computedValues = useMemo(() => {
    const error = renderingState.error || configError
    const isLoading = !renderingState.isLoaded && !error
    const showImage = !!previewState.backgroundImage && !previewState.is3D && !isLoading
    const showCanvas = previewState.is3D && !isLoading

    return { error, isLoading, showImage, showCanvas }
  }, [renderingState.error, renderingState.isLoaded, configError, previewState.backgroundImage, previewState.is3D])

  // Memoized styles
  const containerStyle = useMemo(
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

  const canvasDimensions = useMemo(
    () => ({
      width: Math.round(width * previewState.pixelRatio),
      height: Math.round(height * previewState.pixelRatio),
    }),
    [width, height, previewState.pixelRatio],
  )

  // Memoized class names
  const containerClassName = useMemo(
    () =>
      classNames('Preview', {
        'is-loading': computedValues.isLoading,
        'is-loaded': renderingState.isLoaded,
        'is-3d': previewState.is3D,
        'has-error': !!computedValues.error,
      }),
    [computedValues.isLoading, renderingState.isLoaded, previewState.is3D, computedValues.error],
  )

  const thumbnailClassName = useMemo(
    () => classNames('thumbnail', { 'is-visible': computedValues.showImage }),
    [computedValues.showImage],
  )

  const canvasClassName = useMemo(
    () => classNames({ 'is-visible': computedValues.showCanvas }),
    [computedValues.showCanvas],
  )

  return (
    <div className={containerClassName} style={containerStyle}>
      <img src={previewState.backgroundImage} className={thumbnailClassName} alt="preview" />
      <canvas
        ref={refs.canvas}
        id={UNITY_CANVAS_ID}
        className={canvasClassName}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        style={canvasStyle}
      />
      {computedValues.error && <div className="error">{computedValues.error}</div>}
    </div>
  )
}

export default React.memo(UnityPreview)
