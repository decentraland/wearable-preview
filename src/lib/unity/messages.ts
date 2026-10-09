import { captureException, captureMessage } from '../sentry'
import { inferHideControls } from './controls'

export enum UnityMethod {
  // Property setters
  SET_MODE = 'SetMode',
  SET_PROFILE = 'SetProfile',
  SET_EMOTE = 'SetEmote',
  SET_URNS = 'SetUrns',
  SET_BACKGROUND = 'SetBackground',
  SET_SKIN_COLOR = 'SetSkinColor',
  SET_HAIR_COLOR = 'SetHairColor',
  SET_EYE_COLOR = 'SetEyeColor',
  SET_BODY_SHAPE = 'SetBodyShape',
  SET_SHOW_ANIMATION_REFERENCE = 'SetShowAnimationReference',
  SET_PROJECTION = 'SetProjection',
  ADD_BASE64 = 'AddBase64',
  CLEAR_BASE64 = 'ClearBase64',
  SET_CONTRACT = 'SetContract',
  SET_ITEM_ID = 'SetItemID',
  SET_TOKEN_ID = 'SetTokenID',
  SET_DISABLE_LOADER = 'SetDisableLoader',
  SET_TYPE = 'SetType',

  // Camera options, applied to the live view
  SET_ZOOM_LEVEL = 'SetZoomLevel',
  SET_WHEEL_ZOOM = 'SetWheelZoom',
  SET_WHEEL_START = 'SetWheelStart',
  SET_CAMERA = 'SetCamera',
  SET_LOCK_ALPHA = 'SetLockAlpha',
  SET_LOCK_BETA = 'SetLockBeta',
  SET_LOCK_RADIUS = 'SetLockRadius',
  SET_PANNING = 'SetPanning',
  SET_DISABLE_AUTO_ROTATE = 'SetDisableAutoRotate',
  SET_AUTO_ROTATE_SPEED = 'SetAutoRotateSpeed',
  SET_OFFSET = 'SetOffset',
  SET_SHOW_THUMBNAIL_BOUNDARIES = 'SetShowThumbnailBoundaries',

  // Control methods
  RELOAD = 'Reload',
  CLEANUP = 'Cleanup',
  SET_HIDE_CONTROLS = 'SetHideControls',

  // Query methods
  GET_ELEMENT_BOUNDS = 'GetElementBounds',

  // Physics
  SET_SPRING_BONES_PARAMS = 'SetSpringBonesParams',
}

// Property mapping to Unity JSBridge methods
const PROPERTY_METHOD_MAP: Record<string, UnityMethod> = {
  unityMode: UnityMethod.SET_MODE,
  profile: UnityMethod.SET_PROFILE,
  emote: UnityMethod.SET_EMOTE,
  urns: UnityMethod.SET_URNS,
  background: UnityMethod.SET_BACKGROUND,
  skin: UnityMethod.SET_SKIN_COLOR,
  hair: UnityMethod.SET_HAIR_COLOR,
  eyes: UnityMethod.SET_EYE_COLOR,
  bodyShape: UnityMethod.SET_BODY_SHAPE,
  showAnimationReference: UnityMethod.SET_SHOW_ANIMATION_REFERENCE,
  projection: UnityMethod.SET_PROJECTION,
  base64s: UnityMethod.ADD_BASE64,
  contractAddress: UnityMethod.SET_CONTRACT,
  itemId: UnityMethod.SET_ITEM_ID,
  tokenId: UnityMethod.SET_TOKEN_ID,
  disableLoader: UnityMethod.SET_DISABLE_LOADER,
  type: UnityMethod.SET_TYPE,
  zoom: UnityMethod.SET_ZOOM_LEVEL,
  wheelZoom: UnityMethod.SET_WHEEL_ZOOM,
  wheelStart: UnityMethod.SET_WHEEL_START,
  camera: UnityMethod.SET_CAMERA,
  lockAlpha: UnityMethod.SET_LOCK_ALPHA,
  lockBeta: UnityMethod.SET_LOCK_BETA,
  lockRadius: UnityMethod.SET_LOCK_RADIUS,
  panning: UnityMethod.SET_PANNING,
  disableAutoRotate: UnityMethod.SET_DISABLE_AUTO_ROTATE,
  autoRotateSpeed: UnityMethod.SET_AUTO_ROTATE_SPEED,
  showThumbnailBoundaries: UnityMethod.SET_SHOW_THUMBNAIL_BOUNDARIES,
}

// Babylon's offset is one camera target, so the three axes travel as one message.
const OFFSET_PROPERTIES = ['offsetX', 'offsetY', 'offsetZ']

// Methods the renderer applies to the live view, so on their own they never warrant a Reload.
const LIVE_METHODS = new Set<UnityMethod>([
  UnityMethod.SET_HIDE_CONTROLS,
  UnityMethod.SET_ZOOM_LEVEL,
  UnityMethod.SET_WHEEL_ZOOM,
  UnityMethod.SET_WHEEL_START,
  UnityMethod.SET_CAMERA,
  UnityMethod.SET_LOCK_ALPHA,
  UnityMethod.SET_LOCK_BETA,
  UnityMethod.SET_LOCK_RADIUS,
  UnityMethod.SET_PANNING,
  UnityMethod.SET_DISABLE_AUTO_ROTATE,
  UnityMethod.SET_AUTO_ROTATE_SPEED,
  UnityMethod.SET_OFFSET,
  UnityMethod.SET_SHOW_THUMBNAIL_BOUNDARIES,
])

// Individual method handlers for specific value transformations
const VALUE_TRANSFORMERS: Record<string, (value: any) => string> = {
  unityMode: (value) => String(value),
  profile: (value) => String(value),
  emote: (value) => String(value),
  urns: (value) => (Array.isArray(value) ? value.join(',') : String(value)),
  background: (value) => (typeof value === 'string' ? value.replace('#', '') : String(value)),
  skin: (value) => (typeof value === 'string' ? value.replace('#', '') : String(value)),
  hair: (value) => (typeof value === 'string' ? value.replace('#', '') : String(value)),
  eyes: (value) => (typeof value === 'string' ? value.replace('#', '') : String(value)),
  bodyShape: (value) => String(value),
  showAnimationReference: (value) => String(value),
  projection: (value) => String(value),
  // base64s are handled specially in sendIndividualOverrideMessages
  contractAddress: (value) => String(value),
  itemId: (value) => String(value),
  tokenId: (value) => String(value),
  disableLoader: (value) => String(value),
  type: (value) => String(value),
  zoom: (value) => String(value),
  wheelZoom: (value) => String(value),
  wheelStart: (value) => String(value),
  camera: (value) => String(value),
  lockAlpha: (value) => String(value),
  lockBeta: (value) => String(value),
  lockRadius: (value) => String(value),
  panning: (value) => String(value),
  disableAutoRotate: (value) => String(value),
  autoRotateSpeed: (value) => String(value),
  showThumbnailBoundaries: (value) => String(value),
}

export const sendUnityMessage = (unityInstance: any, method: UnityMethod | string, value?: any) => {
  if (unityInstance) {
    try {
      // Validate that the method is supported
      const methodString = String(method)
      const isValidMethod = Object.values(UnityMethod).includes(methodString as UnityMethod)

      if (!isValidMethod) {
        console.warn(`Unknown Unity method: ${methodString}. Sending anyway...`)
        captureMessage(`Unknown Unity method: ${methodString}`, { method: methodString, value })
      }

      if (value !== undefined) {
        unityInstance.SendMessage('JSBridge', methodString, value)
      } else {
        unityInstance.SendMessage('JSBridge', methodString)
      }
    } catch (error) {
      console.error(`Failed to send Unity message ${method}:`, error)
      captureException(error, { method: String(method), value })
    }
  } else {
    console.warn(`Unity instance not ready, cannot send message: ${method}`)
    captureMessage(`Unity instance not ready, cannot send message: ${method}`, { method: String(method) })
  }
}

export const sendIndividualOverrideMessages = (
  unityInstance: any,
  overrides: Record<string, any>,
  overrideSources: Record<string, boolean>,
) => {
  if (!unityInstance) {
    console.warn('Unity instance not available, cannot send override messages')
    captureMessage('Unity instance not available, cannot send override messages')
    return
  }

  let reloadNeeded = false

  // Handle base64s specially - clear existing ones first
  if (overrides.base64s !== undefined && overrideSources.base64s) {
    sendUnityMessage(unityInstance, UnityMethod.CLEAR_BASE64)
    reloadNeeded = true

    if (Array.isArray(overrides.base64s) && overrides.base64s.length > 0) {
      overrides.base64s.forEach((base64) => {
        sendUnityMessage(unityInstance, UnityMethod.ADD_BASE64, base64)
      })
    }
  }

  const isOverridden = (key: string) => overrideSources[key] && overrides[key] !== undefined

  if (OFFSET_PROPERTIES.some(isOverridden)) {
    const offset = OFFSET_PROPERTIES.map((key) => Number(overrides[key]) || 0).join(',')
    sendUnityMessage(unityInstance, UnityMethod.SET_OFFSET, offset)
  }

  // Handle all other properties
  Object.entries(overrides).forEach(([key, value]) => {
    // Skip the ones handled above
    if (key === 'base64s' || OFFSET_PROPERTIES.includes(key)) return

    // Only send if this property has an override source and the value is defined
    if (isOverridden(key)) {
      const unityMethod = PROPERTY_METHOD_MAP[key]

      if (unityMethod) {
        const transformer = VALUE_TRANSFORMERS[key]
        const transformedValue = transformer ? transformer(value) : String(value)
        sendUnityMessage(unityInstance, unityMethod, transformedValue)
        if (!LIVE_METHODS.has(unityMethod)) reloadNeeded = true
      } else {
        console.warn(`No Unity method mapping found for property: ${key}`)
        captureMessage(`No Unity method mapping found for property: ${key}`, { property: key, value })
      }
    }
  })

  // A page that starts framing the canvas through Babylon's options gets the in-canvas controls out
  // of its way, the same as a mount that passed them in the URL (see controls.ts).
  if (inferHideControls(overrides)) {
    sendUnityMessage(unityInstance, UnityMethod.SET_HIDE_CONTROLS, 'true')
  }

  // Send Reload after all property messages have been sent, unless everything applied to the live view
  if (reloadNeeded) {
    sendUnityMessage(unityInstance, UnityMethod.RELOAD)
  }
}

// Utility functions for common Unity commands
export const reloadUnity = (unityInstance: any) => {
  sendUnityMessage(unityInstance, UnityMethod.RELOAD)
}

export const clearBase64 = (unityInstance: any) => {
  sendUnityMessage(unityInstance, UnityMethod.CLEAR_BASE64)
}

// Utility function to send a single property update
export const sendSingleProperty = (unityInstance: any, property: keyof typeof PROPERTY_METHOD_MAP, value: any) => {
  const unityMethod = PROPERTY_METHOD_MAP[property]

  if (unityMethod) {
    const transformer = VALUE_TRANSFORMERS[property]
    const transformedValue = transformer ? transformer(value) : String(value)

    sendUnityMessage(unityInstance, unityMethod, transformedValue)
  } else {
    console.warn(`No Unity method mapping found for property: ${property}`)
  }
}

// Legacy support - keeping the old method for backward compatibility
export const sendSetOverridesMessage = sendIndividualOverrideMessages
