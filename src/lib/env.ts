export const isDev = process.env.NODE_ENV !== 'production'

export function isIOs() {
  return ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform)
}
