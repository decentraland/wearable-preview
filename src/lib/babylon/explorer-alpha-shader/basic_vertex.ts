export const customBasicVertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;

uniform mat4 worldViewProjection;

out vec2 vUV;

void main(void) {
    gl_Position = worldViewProjection * vec4(position, 1.0);

    vUV = vec2(uv.x, 1.0 - uv.y);
}`