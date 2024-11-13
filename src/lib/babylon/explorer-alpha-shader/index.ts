import { ShaderMaterial, ShaderLanguage, Scene, ShaderStore } from '@babylonjs/core'
import { customFragmentShader } from './fragment'
import { customVertexShader } from './vertex'

export function createShader(scene: Scene) {
  ShaderStore.ShadersStore['customVertexShader'] = customVertexShader
  ShaderStore.ShadersStore['customFragmentShader'] = customFragmentShader
  return new ShaderMaterial(
    'shader',
    scene,
    {
      vertex: 'custom',
      fragment: 'custom',
    },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection','time','direction'],
      uniformBuffers: undefined,
      samplers: ['textureSampler'],
      defines: ['MyDefine'],
      needAlphaBlending: true,
      shaderLanguage: ShaderLanguage.GLSL,
    }
  )
}
