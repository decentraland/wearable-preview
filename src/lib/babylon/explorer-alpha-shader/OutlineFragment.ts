export const customOutlineFragmentShader = `#version 300 es
precision highp float;

in vec4 pos;
in vec2 uv0;

uniform mat4 world;
uniform mat4 worldView;
uniform mat4 worldViewProjection;
uniform sampler2D sampler_MainTex;
uniform vec4 _LightColor0;
uniform vec4 _BaseColor;
uniform vec4 unity_AmbientEquator;
uniform vec4 envLightSource_SkyboxIntensity;
uniform float _Unlit_Intensity;
uniform float _Is_LightColor_Outline;
uniform vec4 sampler_MainTex_ST;
uniform vec4 _Outline_Color;
uniform float _Is_BlendBaseColor;
uniform float _Inverse_Clipping;
uniform float _Clipping_Level;

uniform sampler2D textureSampler;

// SH block feature
vec4 unity_SHAr = vec4( 0.00f, -0.00973f, 0.00f, 0.41196f );
vec4 unity_SHAg = vec4( 0.00f, 0.10704f, 0.00f, 0.30608f );
vec4 unity_SHAb = vec4( 0.00f, 0.12774f, 0.00f, 0.44097f );
vec4 unity_SHBr = vec4( 0.00f, 0.00f, 0.0337f, 0.00f );
vec4 unity_SHBg = vec4( 0.00f, 0.00f, 0.02523f, 0.00f );
vec4 unity_SHBb = vec4( 0.00f, 0.00f, 0.05021f, 0.00f );
vec4 unity_SHC = vec4( 0.0337f, 0.02523f, 0.05021f, 1.00f );

#define TRANSFORM_TEX(tex, name) ((tex.xy) * sampler_MainTex_ST.xy + sampler_MainTex_ST.zw)
//#define SAMPLE_MAINTEX(uv) texture(sampler_MainTex, uv)
#define SAMPLE_MAINTEX(uv) texture(textureSampler, uv)

out vec4 fragColor;

vec3 LinearToGammaSpace (vec3 linRGB)
{
    linRGB = max(linRGB, vec3(0.0, 0.0, 0.0));
    linRGB.r = pow(linRGB.r, 0.416666667);
    linRGB.g = pow(linRGB.g, 0.416666667);
    linRGB.b = pow(linRGB.b, 0.416666667);
    // An almost-perfect approximation from http://chilliant.blogspot.com.au/2012/08/srgb-approximations-for-hlsl.html?m=1
    return max(1.055 * linRGB - 0.055, vec3(0.0));

    // Exact version, useful for debugging.
    //return half3(LinearToGammaSpaceExact(linRGB.r), LinearToGammaSpaceExact(linRGB.g), LinearToGammaSpaceExact(linRGB.b));
}

// normal should be normalized, w=1.0
vec3 SHEvalLinearL0L1(vec4 normal)
{
    vec3 x;

    // Linear (L1) + constant (L0) polynomial terms
    x.r = dot(unity_SHAr, normal);
    x.g = dot(unity_SHAg, normal);
    x.b = dot(unity_SHAb, normal);

    return x;
}

// normal should be normalized, w=1.0
vec3 SHEvalLinearL2(vec4 normal)
{
    vec3 x1, x2;
    // 4 of the quadratic (L2) polynomials
    vec4 vB = normal.xyzz * normal.yzzx;
    x1.r = dot(unity_SHBr, vB);
    x1.g = dot(unity_SHBg, vB);
    x1.b = dot(unity_SHBb, vB);

    // Final (5th) quadratic (L2) polynomial
    float vC = normal.x*normal.x - normal.y*normal.y;
    x2 = unity_SHC.rgb * vC;

    return x1 + x2;
}

// normal should be normalized, w=1.0
// output in active color space
vec3 ShadeSH9(vec4 normal)
{
    // Linear + constant polynomial terms
    vec3 res = SHEvalLinearL0L1(normal);

    // Quadratic polynomials
    res += SHEvalLinearL2(normal);

    #ifdef UNITY_COLORSPACE_GAMMA
        res = LinearToGammaSpace(res);
    #endif

    return res;
}

void main(void)
{
    if (gl_FrontFacing)
        discard;
    
    vec4 objPos = world * vec4(0,0,0,1);

    vec3 envLightSource_GradientEquator = unity_AmbientEquator.rgb;
    vec3 envLightSource_SkyboxIntensity = max(ShadeSH9(vec4(0.0f, 0.0f, 0.0f, 1.0f)),ShadeSH9(vec4(0.0f, -1.0f, 0.0f, 1.0f))).rgb;
    vec3 ambientSkyColor = envLightSource_SkyboxIntensity.rgb * _Unlit_Intensity; // : envLightSource_GradientEquator*_Unlit_Intensity;

    vec3 lightColor = _LightColor0.rgb;// >0.05f ? _LightColor0.rgb : ambientSkyColor.rgb;
    float lightColorIntensity = (0.299f*lightColor.r + 0.587f*lightColor.g + 0.114f*lightColor.b);
    lightColor = lightColorIntensity<1.0f ? lightColor : lightColor/lightColorIntensity;
    lightColor = mix(vec3(1.0f, 1.0f, 1.0f), lightColor, _Is_LightColor_Outline);
    
    vec2 Set_UV0 = uv0;

    vec2 uv_maintex = TRANSFORM_TEX(Set_UV0, _MainTex);
    uv_maintex = Set_UV0; // TEST
    vec4 _MainTex_var = SAMPLE_MAINTEX(uv_maintex);

    vec3 Set_BaseColor = _BaseColor.rgb*_MainTex_var.rgb;
    vec3 _Is_BlendBaseColor_var = mix( _Outline_Color.rgb*lightColor, (_Outline_Color.rgb*Set_BaseColor*Set_BaseColor*lightColor), _Is_BlendBaseColor );

    float Set_MainTexAlpha = _MainTex_var.a;
    float _IsBaseMapAlphaAsClippingMask_var = Set_MainTexAlpha;
    float _Inverse_Clipping_var = mix( _IsBaseMapAlphaAsClippingMask_var, (1.0f - _IsBaseMapAlphaAsClippingMask_var), _Inverse_Clipping );
    float Set_Clipping = clamp((_Inverse_Clipping_var+_Clipping_Level), 0.0f, 1.0f);
    if ((Set_MainTexAlpha - 0.5f) <= 0.0f)
        discard;
    vec4 Set_Outline_Color = vec4(_Is_BlendBaseColor_var,Set_Clipping);
    fragColor = Set_Outline_Color;
    //fragColor = _MainTex_var;
}`