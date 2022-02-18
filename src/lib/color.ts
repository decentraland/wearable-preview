import { Color3 } from '@babylonjs/core'
import { Color3 as RGB } from '@dcl/schemas'

export function formatHex(color: string) {
  return color.startsWith('#') ? color : '#' + color
}

export function parseHex(color: string) {
  return color.startsWith('#') ? color.slice(1) : color
}

export function numberToHex(value: number) {
  const hex = ((value * 255) | 0).toString(16)
  return ('0' + hex).slice(-2)
}

export function colorToHex(color: RGB) {
  return numberToHex(color.r) + numberToHex(color.g) + numberToHex(color.b)
}

export function hexToColor(hex: string) {
  const parsed = parseHex(hex)
  const color = new Color3(
    parseInt(parsed.slice(0, 2), 16) / 256,
    parseInt(parsed.slice(2, 4), 16) / 256,
    parseInt(parsed.slice(4, 6), 16) / 256
  )
  return color
}
