/**
 * WebGPU detection utility
 * Checks if WebGPU is supported and available in the current browser
 */

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
}

/**
 * Detects WebGPU support and availability
 * @returns Promise<WebGPUSupport> - Object containing support status and error details
 */
export async function detectWebGPU(): Promise<WebGPUSupport> {
  // Check if navigator.gpu exists (basic support)
  if (!navigator.gpu) {
    return {
      isSupported: false,
      isAvailable: false,
      error: 'WebGPU is not supported in this browser. Please use Chrome 113+, Firefox 113+, or Safari 16.4+',
    }
  }

  try {
    // Try to request an adapter to check if WebGPU is actually available
    const adapter = await navigator.gpu.requestAdapter()

    if (!adapter) {
      return {
        isSupported: true,
        isAvailable: false,
        error:
          'WebGPU is supported but no adapter is available. This might be due to hardware limitations or driver issues.',
      }
    }

    // Try to request a device to ensure WebGPU is fully functional
    const device = await adapter.requestDevice()

    if (!device) {
      return {
        isSupported: true,
        isAvailable: false,
        error:
          'WebGPU adapter found but failed to create device. This might be due to hardware limitations or driver issues.',
      }
    }

    return {
      isSupported: true,
      isAvailable: true,
    }
  } catch (error) {
    return {
      isSupported: true,
      isAvailable: false,
      error: `WebGPU is supported but failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Gets browser-specific instructions for enabling WebGPU
 * @returns string - Instructions for the current browser
 */
export function getWebGPUInstructions(): string {
  const userAgent = navigator.userAgent.toLowerCase()

  if (userAgent.includes('chrome')) {
    return 'Enable WebGPU in Chrome by going to chrome://flags/#enable-unsafe-webgpu and setting it to "Enabled", then restart your browser.'
  } else if (userAgent.includes('firefox')) {
    return 'Enable WebGPU in Firefox by going to about:config, searching for "webgpu", and setting webgpu.force-enabled to true, then restart your browser.'
  } else if (userAgent.includes('safari')) {
    return 'Enable WebGPU in Safari by going to Settings → Feature Flags, searching for "WebGPU", and enabling the "WebGPU" option. Then restart your browser.'
  } else if (userAgent.includes('edge')) {
    return 'Enable WebGPU in Edge by going to edge://flags/#enable-unsafe-webgpu and setting it to "Enabled", then restart your browser.'
  }

  return 'Please update your browser to a version that supports WebGPU (Chrome 113+, Firefox 113+, Safari 16.4+, or Edge 113+).'
}
