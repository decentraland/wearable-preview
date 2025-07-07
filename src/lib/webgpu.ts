// TypeScript declarations for WebGPU
declare global {
  interface Navigator {
    gpu?: GPU
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>
  }

  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance'
    forceFallbackAdapter?: boolean
  }

  interface GPUAdapter {
    name: string
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>
  }

  interface GPUDeviceDescriptor {
    label?: string
    requiredFeatures?: GPUFeatureName[]
    requiredLimits?: Record<string, number>
  }

  interface GPUDevice {
    label?: string
  }

  type GPUFeatureName = string
}

export interface WebGPUSupport {
  isSupported: boolean
  isAvailable: boolean
  error?: string
  platform: string
  browser: string
  platformVersion: string
  browserVersion: string
}

/**
 * Detects the platform and browser from the user agent with improved accuracy.
 * @returns An object containing the platform and browser names.
 */
const detectPlatformAndBrowser = (): { platform: string; browser: string; version: string } => {
  const ua = navigator.userAgent.toLowerCase()
  let platform = 'Unknown'
  let browser = 'Unknown'
  let version = 'Unknown'

  // Platform detection with improved accuracy
  if (/android/.test(ua)) {
    platform = 'Android'
    // Extract Android version
    const androidMatch = ua.match(/android\s*([0-9.]+)/)
    if (androidMatch) {
      version = androidMatch[1]
    }
  } else if (/iphone|ipad|ipod/.test(ua)) {
    platform = 'iOS'
    // Extract iOS version
    const iosMatch = ua.match(/os\s*([0-9_]+)/)
    if (iosMatch) {
      version = iosMatch[1].replace(/_/g, '.')
    }
  } else if (/macintosh|mac os x/.test(ua)) {
    platform = 'macOS'
    // Extract macOS version
    const macMatch = ua.match(/mac os x\s*([0-9_]+)/)
    if (macMatch) {
      version = macMatch[1].replace(/_/g, '.')
    }
  } else if (/windows/.test(ua)) {
    platform = 'Windows'
    // Extract Windows version
    const windowsMatch = ua.match(/windows nt\s*([0-9.]+)/)
    if (windowsMatch) {
      version = windowsMatch[1]
    }
  } else if (/linux/.test(ua)) {
    platform = 'Linux'
    // Extract Linux distribution if available
    const linuxMatch = ua.match(/\(([^)]+)\)/)
    if (linuxMatch) {
      version = linuxMatch[1]
    }
  }

  // Browser detection with version extraction
  if (/chrome|crios/.test(ua)) {
    browser = 'Chrome'
    const chromeMatch = ua.match(/(?:chrome|crios)\/([0-9.]+)/)
    if (chromeMatch) {
      version = chromeMatch[1]
    }
  } else if (/firefox|fxios/.test(ua)) {
    browser = 'Firefox'
    const firefoxMatch = ua.match(/(?:firefox|fxios)\/([0-9.]+)/)
    if (firefoxMatch) {
      version = firefoxMatch[1]
    }
  } else if (/safari/.test(ua) && !/chrome|crios|android/.test(ua)) {
    browser = 'Safari'
    const safariMatch = ua.match(/version\/([0-9.]+)/)
    if (safariMatch) {
      version = safariMatch[1]
    }
  } else if (/edg/.test(ua)) {
    browser = 'Edge'
    const edgeMatch = ua.match(/edg\/([0-9.]+)/)
    if (edgeMatch) {
      version = edgeMatch[1]
    }
  }

  return { platform, browser, version }
}

/**
 * Detects WebGPU support and availability.
 * @returns Promise<WebGPUSupport> - Object containing support status and error details.
 */
export const detectWebGPU = async (): Promise<WebGPUSupport> => {
  const { platform, browser, version } = detectPlatformAndBrowser()

  if (!navigator.gpu) {
    console.warn('❌ navigator.gpu is not available')
    return {
      isSupported: false,
      isAvailable: false,
      error: 'WebGPU is not supported in this browser. Please use a compatible browser.',
      platform,
      browser,
      platformVersion: version,
      browserVersion: version,
    }
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()

    if (!adapter) {
      console.warn('❌ No WebGPU adapter available')
      return {
        isSupported: true,
        isAvailable: false,
        error:
          'WebGPU is supported but no adapter is available. This might be due to hardware limitations or driver issues.',
        platform,
        browser,
        platformVersion: version,
        browserVersion: version,
      }
    }

    const device = await adapter.requestDevice()

    if (!device) {
      console.warn('❌ Failed to create WebGPU device')
      return {
        isSupported: true,
        isAvailable: false,
        error:
          'WebGPU adapter found but failed to create device. This might be due to hardware limitations or driver issues.',
        platform,
        browser,
        platformVersion: version,
        browserVersion: version,
      }
    }

    return {
      isSupported: true,
      isAvailable: true,
      platform,
      browser,
      platformVersion: version,
      browserVersion: version,
    }
  } catch (error) {
    console.error('❌ WebGPU detection error:', error)
    return {
      isSupported: true,
      isAvailable: false,
      error: `WebGPU is supported but failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
      platform,
      browser,
      platformVersion: version,
      browserVersion: version,
    }
  }
}

/**
 * Provides browser-specific instructions for enabling WebGPU with version-aware guidance.
 * @param platform - The detected platform (e.g., 'Android', 'iOS').
 * @param browser - The detected browser (e.g., 'Chrome', 'Safari').
 * @param platformVersion - The platform version.
 * @param browserVersion - The browser version.
 * @returns A string with detailed instructions for enabling WebGPU.
 */
export const getWebGPUInstructions = (
  platform: string,
  browser: string,
  platformVersion: string,
  browserVersion: string,
): string => {
  const browserVersionNum = parseFloat(browserVersion.split('.')[0]) || 0
  const platformVersionNum = parseFloat(platformVersion.split('.')[0]) || 0

  // iOS specific instructions
  if (platform === 'iOS') {
    if (browser === 'Safari') {
      if (platformVersionNum >= 17.4) {
        return `WebGPU is available in iOS ${platformVersion} and Safari ${browserVersion}. To enable it:
1. Go to Settings > Safari > Advanced > Feature Flags
2. Find "WebGPU" and toggle it ON
3. Restart Safari
4. WebGPU should now be available for web applications.`
      } else {
        return `WebGPU requires iOS 17.4 or later. You're currently running iOS ${platformVersion}. Please update your iOS version to enable WebGPU support.`
      }
    } else {
      return `WebGPU is currently only supported in Safari on iOS 17.4+. You're using ${browser} on iOS ${platformVersion}. Please use Safari or update to iOS 17.4+.`
    }
  }

  // Android specific instructions
  if (platform === 'Android') {
    if (browser === 'Chrome') {
      if (browserVersionNum >= 121 && platformVersionNum >= 12) {
        return `WebGPU is enabled by default in Chrome ${browserVersion} on Android ${platformVersion}. If it's not working:
1. Go to chrome://flags/#enable-unsafe-webgpu
2. Set it to "Enabled"
3. Restart Chrome
4. WebGPU should now be available.`
      } else if (browserVersionNum >= 113) {
        return `WebGPU is available in Chrome ${browserVersion} but requires Android 12+ for full support. You're running Android ${platformVersion}. To enable:
1. Go to chrome://flags/#enable-unsafe-webgpu
2. Set it to "Enabled"
3. Restart Chrome
Note: Some features may be limited on Android ${platformVersion}.`
      } else {
        return `WebGPU requires Chrome 113+ and Android 12+. You're running Chrome ${browserVersion} on Android ${platformVersion}. Please update both Chrome and Android.`
      }
    } else if (browser === 'Firefox') {
      if (browserVersionNum >= 113) {
        return `To enable WebGPU in Firefox ${browserVersion} on Android ${platformVersion}:
1. Go to about:config
2. Search for "webgpu"
3. Set webgpu.force-enabled to true
4. Set webgpu.unsafe.enable to true
5. Restart Firefox
Note: WebGPU support in Firefox for Android is experimental.`
      } else {
        return `WebGPU requires Firefox 113+ on Android. You're running Firefox ${browserVersion}. Please update Firefox to enable WebGPU support.`
      }
    } else {
      return `WebGPU is currently best supported in Chrome 121+ or Firefox 113+ on Android 12+. You're using ${browser} on Android ${platformVersion}. Please use Chrome or Firefox.`
    }
  }

  // Desktop instructions
  if (browser === 'Chrome') {
    if (browserVersionNum >= 113) {
      return `To enable WebGPU in Chrome ${browserVersion}:
1. Navigate to chrome://flags/#enable-unsafe-webgpu
2. Set "Unsafe WebGPU" to "Enabled"
3. Click "Relaunch" to restart Chrome
4. WebGPU should now be available for web applications.

Note: WebGPU is still considered experimental in Chrome. Some features may be unstable.`
    } else {
      return `WebGPU requires Chrome 113+. You're running Chrome ${browserVersion}. Please update Chrome to enable WebGPU support.`
    }
  } else if (browser === 'Firefox') {
    if (browserVersionNum >= 113) {
      return `To enable WebGPU in Firefox ${browserVersion}:
1. Navigate to about:config
2. Search for "webgpu"
3. Set webgpu.force-enabled to true
4. Set webgpu.unsafe.enable to true
5. Restart Firefox
6. WebGPU should now be available.

Note: WebGPU support in Firefox is experimental and may be unstable.`
    } else {
      return `WebGPU requires Firefox 113+. You're running Firefox ${browserVersion}. Please update Firefox to enable WebGPU support.`
    }
  } else if (browser === 'Safari') {
    if (browserVersionNum >= 16.4) {
      return `To enable WebGPU in Safari ${browserVersion}:
1. Go to Safari > Settings > Feature Flags
2. Find "WebGPU" and enable it
3. Restart Safari
4. WebGPU should now be available.

Note: WebGPU support in Safari is experimental.`
    } else {
      return `WebGPU requires Safari 16.4+. You're running Safari ${browserVersion}. Please update Safari to enable WebGPU support.`
    }
  } else if (browser === 'Edge') {
    if (browserVersionNum >= 113) {
      return `To enable WebGPU in Edge ${browserVersion}:
1. Navigate to edge://flags/#enable-unsafe-webgpu
2. Set "Unsafe WebGPU" to "Enabled"
3. Click "Restart" to restart Edge
4. WebGPU should now be available.

Note: WebGPU is still considered experimental in Edge.`
    } else {
      return `WebGPU requires Edge 113+. You're running Edge ${browserVersion}. Please update Edge to enable WebGPU support.`
    }
  }

  return `WebGPU is not supported in ${browser} on ${platform}. Please use a supported browser:
- Chrome 113+ (desktop/mobile)
- Firefox 113+ (desktop/mobile)
- Safari 16.4+ (desktop/iOS 17.4+)
- Edge 113+ (desktop)`
}
