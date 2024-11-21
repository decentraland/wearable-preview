import { ShaderMaterial, ShaderLanguage, Scene, Effect } from '@babylonjs/core'
import { customFragmentShader } from './fragment'
import { customVertexShader } from './vertex'

export function createShader(scene: Scene, shaderId: string) {
  Effect.ShadersStore['customVertexShader'] = customVertexShader
  Effect.ShadersStore['customFragmentShader'] = customFragmentShader
  return new ShaderMaterial(
    shaderId,
    scene,
    {
      vertex: 'custom',
      fragment: 'custom',
    },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection', 'time', 'direction'],
      uniformBuffers: undefined,
      samplers: [
        'sampler_MainTex',
        'sampler_NormalMap',
        'sampler_Emissive_Tex',
        'MAINTEX',
      ],
      defines: [],
      shaderLanguage: ShaderLanguage.GLSL,
    }
  )
}
