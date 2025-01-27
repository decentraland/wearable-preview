export const customOutlineVertexShader = `#version 300 es
precision highp float;

// Attributes
in vec3 position;
in vec2 uv;
in vec3 normal;
//in vec4 tangent;

// Uniforms
uniform mat4 worldView;
uniform mat4 worldViewProjection;
uniform float _Outline_Width;
uniform float _Nearest_Distance;
uniform float _Farthest_Distance;
uniform float _ZOverDrawMode;
uniform float _Offset_Z;

// Varying
out vec4 pos;
out vec2 uv0;

void main(void)
{
    // gl_Position = worldViewProjection * vec4(position, 1.0);

    // vUV = uv;
    
    uv0 = uv;
    vec4 objPos = worldViewProjection * vec4(0.0f,0.0f,0.0f,1.0f);

    vec3 cameraPos = vec3(worldView[3][0], worldView[3][1], worldView[3][2]);
    float Set_Outline_Width = (_Outline_Width*0.001f*smoothstep( _Farthest_Distance, _Nearest_Distance, distance(objPos.rgb,cameraPos)));
    Set_Outline_Width *= (1.0f - _ZOverDrawMode);

    
    vec4 _ClipCameraPos = worldViewProjection * vec4(cameraPos.xyz, 1.0f);

    pos = worldViewProjection * vec4(position.xyz + normal*Set_Outline_Width,1.0f);
    float fOffset_Z = _Offset_Z * 0.01f;
    pos.z = pos.z + _Offset_Z * _ClipCameraPos.z;
    gl_Position = pos;
    // return o;
}`