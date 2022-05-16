float angleY = 3.14 / 2.0;

mat3 rotateY = mat3(
  cos(angleY), 0, sin(angleY),
  0, 1, 0,
  -sin(angleY), 0, cos(angleY)
);

// view angle DOT normal of the position
vec3 tray = normalize(viewDirectionW * rotateY);
vec3 rayDirection = normalize(tray-vPositionW);
float t=(dot(normalW,rayDirection) + 1.0) / 2.0;

float ToonThresholds[3];
ToonThresholds[0] = 0.90;
ToonThresholds[1] = 0.80;
ToonThresholds[2] = 0.20;

float ToonBrightnessLevels[4];
ToonBrightnessLevels[0] = 1.2;
ToonBrightnessLevels[1] = 1.0;
ToonBrightnessLevels[2] = 1.0;
ToonBrightnessLevels[3] = 0.8;

if (t > ToonThresholds[0])
{
  finalColor.rgb *= ToonBrightnessLevels[0];
}
else if (t > ToonThresholds[1])
{
  finalColor.rgb *= ToonBrightnessLevels[1];
}
else if (t > ToonThresholds[2])
{
  finalColor.rgb *= ToonBrightnessLevels[2];
}
else
{
  finalColor.rgb *= ToonBrightnessLevels[3];
}
