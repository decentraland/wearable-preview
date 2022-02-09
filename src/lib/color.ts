import { Color3 } from '@dcl/schemas'

export function formatHex(color: string) {
  return color.startsWith('#') ? color : '#' + color
}

export function numberToHex(value: number) {
  const hex = ((value * 255) | 0).toString(16)
  return ('0' + hex).slice(-2)
}

export function colorToHex(color: Color3) {
  return numberToHex(color.r) + numberToHex(color.g) + numberToHex(color.b)
}
