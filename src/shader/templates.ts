export const fragmentTemplate = `precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_seed;
uniform float u_noiseScale;
uniform float u_warp;
uniform float u_speed;
uniform float u_contrast;
uniform float u_hueShift;
uniform float u_grain;
uniform vec3 u_paletteA;
uniform vec3 u_paletteB;
uniform vec3 u_paletteC;
uniform vec3 u_extraColors[21];
uniform float u_extraCount;
uniform vec4 u_textureWeights;
uniform float u_textureScale;
uniform vec4 u_motionWeights;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.6;
  for (int i = 0; i < 4; i++) {
    value += amp * noise(p);
    p *= 2.1;
    amp *= 0.55;
  }
  return value;
}

vec2 warp(vec2 p, float t) {
  float n1 = noise(p * 1.5 + vec2(t, -t));
  float n2 = noise(p * 2.3 + vec2(-t, t));
  return p + u_warp * vec2(n1 - 0.5, n2 - 0.5);
}

vec3 palette(float t) {
  vec3 a = u_paletteA;
  vec3 b = u_paletteB;
  vec3 c = u_paletteC;
  return a + b * cos(6.28318 * (c * t + u_hueShift));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
  float motionSlow = sin(u_time * 0.2 + u_seed);
  float motionPulse = sin(u_time * 0.9 + u_seed * 1.7);
  float motionJitter = noise(uv * 6.0 + u_time * 1.2);
  float motionSpin = sin(u_time * 0.35 + u_seed * 0.4);
  float motionBlend =
    u_motionWeights.x * motionSlow +
    u_motionWeights.y * motionPulse +
    u_motionWeights.z * motionJitter +
    u_motionWeights.w * motionSpin;
  float t = u_time * (0.08 + 0.12 * u_speed) + u_seed + 0.3 * motionBlend;

  vec2 p = vec2(uv.x * (1.25 + 0.1 * u_noiseScale), (uv.y - 0.75) * 1.1);
  p = warp(p, t);

  vec2 centerA = vec2(sin(u_seed * 1.3), cos(u_seed * 1.7)) * 0.25 + vec2(0.0, -0.35);
  vec2 centerB = vec2(cos(u_seed * 2.1), sin(u_seed * 2.6)) * 0.32 + vec2(0.0, -0.42);
  float distA = length(vec2((p.x - centerA.x) * 0.75, p.y - centerA.y));
  float distB = length(vec2((p.x - centerB.x) * 0.75, p.y - centerB.y)) * 0.85;
  float dist = min(distA, distB);

  float shape = 1.2 - dist;
  float wobble = fbm(p * 1.4 + t);
  float bleed = fbm(p * 3.2 - t * 0.6);

  float blot = smoothstep(-0.3, 0.7, shape + 0.55 * wobble);
  float edge = smoothstep(0.05, 0.55, shape + 0.25 * bleed);
  float pigment = pow(blot, mix(1.4, 0.7, u_contrast));

  float v = clamp(pigment + 0.35 * wobble, 0.0, 1.0);
  vec3 col = palette(v * 1.1);

  vec3 paper = vec3(0.98, 0.975, 0.97);
  col = mix(paper, col, blot);

  vec3 extraCol = vec3(0.0);
  float extraWeight = 0.0;
  for (int i = 0; i < 21; i++) {
    float active = step(float(i), u_extraCount - 0.5);
    vec2 seedOffset = vec2(sin(u_seed + float(i) * 1.7), cos(u_seed - float(i) * 1.3));
    vec2 center = seedOffset * (0.55 + 0.07 * float(i)) + vec2(0.0, -0.4);
    float distExtra = length(vec2((p.x - center.x) * 0.75, p.y - center.y));
    float shapeExtra = 0.95 - distExtra;
    float extraWobble = fbm(p * (1.0 + 0.12 * float(i)) + t * 0.4);
    float extraMask = smoothstep(-0.35, 0.65, shapeExtra + 0.55 * extraWobble);
    extraMask *= active;
    float feather = smoothstep(0.0, 0.8, extraMask);
    extraCol += u_extraColors[i] * feather;
    extraWeight += feather;
  }
  if (extraWeight > 0.0) {
    vec3 blended = extraCol / extraWeight;
    col = mix(col, blended, clamp(extraWeight * 0.35, 0.0, 1.0));
  }

  float paperTex = fbm(uv * 6.5 + vec2(u_seed * 0.2));
  col *= 1.0 - 0.12 * paperTex;

  float textureScale = 2.0 + 6.0 * u_textureScale;
  float circles = smoothstep(0.45, 0.1, abs(sin(length(p * textureScale) * 2.8)));
  float stripes = smoothstep(0.6, 0.2, abs(sin((p.x + p.y) * textureScale * 1.4)));
  vec2 grid = abs(fract(p * textureScale) - 0.5);
  float rectangles = smoothstep(0.45, 0.15, max(grid.x, grid.y));
  float abstract = fbm(p * textureScale * 1.6 + t);
  float textureMix =
    u_textureWeights.x * circles +
    u_textureWeights.y * stripes +
    u_textureWeights.z * rectangles +
    u_textureWeights.w * abstract;
  float textureMask = clamp(textureMix, 0.0, 1.0);
  col = mix(col, col * (0.75 + 0.25 * textureMask), textureMask * 0.35);

  col = mix(col, col * 0.82, edge * 0.35);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.25);
  col = clamp(col * 1.05, 0.0, 1.0);

  float g = (hash21(gl_FragCoord.xy + u_seed) - 0.5) * u_grain;
  col += g * 0.6;

  gl_FragColor = vec4(col, 1.0);
}
`;
