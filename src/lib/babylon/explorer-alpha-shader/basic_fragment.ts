export const customBasicFragmentShader = `#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D textureSampler;
uniform int materialType;
uniform float alpha;   

out vec4 fragColor;

void main(void) {
    vec4 baseTexture = texture(textureSampler, vUV);  // Sample the texture
     if (materialType == 0) {
        fragColor = vec4(baseTexture.rgb, baseTexture.a * alpha);
    } else {
        fragColor = baseTexture;
    }
}`
