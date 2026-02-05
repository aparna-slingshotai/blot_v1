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

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec3 pal(float t, vec3 baseA, vec3 baseB, vec3 phase) {
  return baseA + baseB * cos(6.28318 * (vec3(0.5, 0.333, 5.0) * t + phase - u_time * 0.4));
}

float getFreq(float f) {
  float base = 0.4 + 0.6 * sin(u_time * 0.3 + f * 12.0 + u_warp * 2.0);
  return base * (0.6 + 0.4 * u_textureScale);
}

vec3 tiedie(vec2 uv, float f, vec3 baseA, vec3 baseB, vec3 phase) {
  float t = u_time * (0.4 + 0.3 * u_speed);
  float fft = getFreq(0.001) * 0.35 - getFreq(0.99) * 0.2;

  uv *= rot(t * 0.9);
  float amp = 0.3 + 0.2 * u_warp;
  float a = atan(uv.y + amp * sin(t), uv.x + amp * cos(t));

  uv.x += amp * cos(sin(a * f + t) * fft + t);
  uv.y += amp * sin(cos(a * f + t) * fft + t);

  return pal((1.0 - exp(-length(uv) * 2.0)) * 3.0 + 0.3, baseA, baseB, phase);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

  float extraMask = clamp(u_extraCount / 5.0, 0.0, 1.0);
  vec3 extraA = u_extraColors[0];
  vec3 extraB = u_extraColors[1];
  vec3 extraC = u_extraColors[2];
  vec3 baseA = mix(u_paletteA, extraA, 0.8);
  vec3 baseB = mix(u_paletteB, extraB, 0.8);
  vec3 baseC = mix(u_paletteC, extraC, 0.8);
  vec3 phase = mix(u_paletteC, vec3(0.1, 0.54, 0.0), 0.6);

  vec3 col = tiedie(uv, 4.0 + 8.0 * u_textureScale, baseA, baseB, phase);
  vec3 col2 = tiedie(uv, 220.0 + 80.0 * u_noiseScale, baseB, baseC, phase + 0.2);

  col = mix(col, col2, 0.2 + 0.4 * extraMask);
  col = pow(col, vec3(2.0 - 0.6 * u_contrast));
  col += vec3(0.4, 0.4, 0.1) * (exp(-length(uv + 0.2 * vec2(cos(u_time * 0.4), sin(u_time * 0.4))) * 1.0));
  col += 0.05 * (noise(uv * 400.0) - 0.5) * u_grain;

  gl_FragColor = vec4(col, 1.0);
}
`;
