// Supported Unity JSBridge methods
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

  // Control methods
  RELOAD = 'Reload',
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
}

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
}

export const sendUnityMessage = (unityInstance: any, method: UnityMethod | string, value?: any) => {
  if (unityInstance) {
    try {
      // Validate that the method is supported
      const methodString = String(method)
      const isValidMethod = Object.values(UnityMethod).includes(methodString as UnityMethod)

      if (!isValidMethod) {
        console.warn(`Unknown Unity method: ${methodString}. Sending anyway...`)
      }

      if (value !== undefined) {
        unityInstance.SendMessage('JSBridge', methodString, value)
      } else {
        unityInstance.SendMessage('JSBridge', methodString)
      }
    } catch (error) {
      console.error(`Failed to send Unity message ${method}:`, error)
    }
  } else {
    console.warn(`Unity instance not ready, cannot send message: ${method}`)
  }
}

export const sendIndividualOverrideMessages = (
  unityInstance: any,
  overrides: Record<string, any>,
  overrideSources: Record<string, boolean>,
) => {
  if (!unityInstance) {
    console.warn('Unity instance not available, cannot send override messages')
    return
  }

  let messagesSent = 0

  // Handle base64s specially - clear existing ones first
  if (overrides.base64s !== undefined && overrideSources.base64s) {
    sendUnityMessage(unityInstance, UnityMethod.CLEAR_BASE64)
    messagesSent++

    if (Array.isArray(overrides.base64s) && overrides.base64s.length > 0) {
      overrides.base64s.forEach((base64) => {
        sendUnityMessage(unityInstance, UnityMethod.ADD_BASE64, base64)
        messagesSent++
      })
    }
  }

  // Handle all other properties
  Object.entries(overrides).forEach(([key, value]) => {
    // Skip base64s as they were handled separately
    if (key === 'base64s') return

    // Only send if this property has an override source and the value is defined
    if (overrideSources[key] && value !== undefined) {
      const unityMethod = PROPERTY_METHOD_MAP[key]

      if (unityMethod) {
        const transformer = VALUE_TRANSFORMERS[key]
        const transformedValue = transformer ? transformer(value) : String(value)
        sendUnityMessage(unityInstance, unityMethod, transformedValue)
        messagesSent++
      } else {
        console.warn(`No Unity method mapping found for property: ${key}`)
      }
    }
  })

  // Send Reload after all property messages have been sent
  if (messagesSent > 0) {
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
