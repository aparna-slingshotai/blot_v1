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

#define PI 3.1415926535897

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

float hash(vec2 p) {
  p = fract(p * vec3(123.34, 456.21, 789.18).xy);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p, float t) {
  float v = 0.0;
  float amp = 0.5;
  vec2 shift = vec2(t * 0.2, t * 0.1);
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p - shift * float(i + 1));
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

float getPetalShape(vec3 p, float t) {
  float a = atan(p.y, p.x);
  float s = 0.5 + 0.5 * sin(7.0 * a + t * 0.5);
  float tVal = 0.3 + 0.3 * pow(s, 0.3);
  tVal += 0.05 * pow(0.5 + 0.5 * cos(12.0 * a), 0.6);
  float n = fbm(p.xy * 15.0, t) * 1.1;
  tVal += 0.22 * (n - 0.5);
  return tVal;
}

float mapScene(vec3 p, float t) {
  vec3 pOrig = p;
  float r = length(p.xy);
  float bend = 0.5 * r * r;
  p.z -= bend;
  float thick = getPetalShape(p, t);
  float dHorizontal = r - thick;
  float thickness = 0.015;
  float dVertical = abs(p.z) - thickness;
  float flower = smax(dHorizontal, dVertical, 0.05);
  return flower;
}

vec3 getNormal(vec3 p, float t) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    mapScene(p + e.xyy, t) - mapScene(p - e.xyy, t),
    mapScene(p + e.yxy, t) - mapScene(p - e.yxy, t),
    mapScene(p + e.yyx, t) - mapScene(p - e.yyx, t)
  ));
}

vec3 getGradient(float t, vec3 colA, vec3 colB) {
  float wave = 0.5 + 0.5 * sin(t);
  return mix(colA, colB, wave);
}

vec3 getFlowerColor(vec3 p, float t) {
  float r = length(p.xy);
  float shape = getPetalShape(p, t);
  float n = fbm(p.xy * 15.0, t) * 1.1;
  vec3 baseFlowerCol = mix(u_paletteA, u_paletteB, 0.6);
  vec3 centerCol = mix(u_paletteC, vec3(1.0, 0.9, 0.2), 0.5);
  float centerMask = smoothstep(0.6, 0.1, r / shape);
  vec3 col = mix(baseFlowerCol, centerCol, centerMask);
  col *= (0.7 + 0.5 * r / shape);
  col *= 0.9 + 0.1 * n;
  return col;
}

void getCameraRay(vec2 uv, float t, out vec3 ro, out vec3 rd) {
  vec2 defaultM = vec2(0.8, 0.45);
  float dist = 1.1;
  ro = vec3(0.0, 0.0, -dist);

  float baseYaw = defaultM.x * PI;
  float basePitch = (defaultM.y - 0.5) * PI;
  float yaw = baseYaw + sin(t * 0.2) * 0.08 * u_speed;
  float pitch = basePitch + cos(t * 0.25) * 0.05 * u_warp;

  ro.yz *= rot(pitch);
  ro.xz *= rot(yaw);

  vec3 ta = vec3(0.0);
  vec3 fwd = normalize(ta - ro);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  rd = normalize(fwd * 1.2 + right * uv.x + up * uv.y);
}

void main() {
  float motionBlend =
    u_motionWeights.x * sin(u_time * 0.25) +
    u_motionWeights.y * sin(u_time * 0.6) +
    u_motionWeights.z * sin(u_time * 1.1) +
    u_motionWeights.w * sin(u_time * 0.35 + 1.7);
  float t = u_time * (0.4 + 0.4 * u_speed) + u_seed * 0.1 + 0.4 * motionBlend;

  vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / u_resolution.y;
  uv *= 1.35;

  vec3 ro, rd;
  getCameraRay(uv, t, ro, rd);

  float tRay = 0.0;
  float tMax = 10.0;
  float d = 0.0;
  vec3 p = vec3(0.0);
  bool hit = false;

  for (int i = 0; i < 140; i++) {
    p = ro + rd * tRay;
    p.xy += 0.12 * sin(p.yx * 3.0 + t * 0.6);
    d = mapScene(p, t);
    if (d < 0.001) {
      hit = true;
      break;
    }
    if (tRay > tMax) {
      break;
    }
    tRay += d * 0.6;
  }

  vec3 col = vec3(0.0);
  if (hit) {
    vec3 n = getNormal(p, t);
    vec3 lightPos = ro + vec3(1.0, 1.0, 0.0);
    vec3 l = normalize(lightPos - p);
    vec3 albedo;
    if (length(p - vec3(0.0, 0.0, 0.05)) < 0.07) {
      albedo = mix(vec3(1.0, 0.9, 0.5), u_paletteC, 0.4);
      col = albedo * 1.5;
    } else {
      albedo = getFlowerColor(p, t);
      float diff = max(dot(n, l), 0.1);
      float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 16.0);
      float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      col = albedo * diff + vec3(1.0) * spec * 0.35 + albedo * rim * 0.6;
    }
  }

  float wSum = u_motionWeights.x + u_motionWeights.y + u_motionWeights.z + u_motionWeights.w;
  vec4 w = wSum > 0.001 ? u_motionWeights / wSum : vec4(0.0);
  float overlayEnable = step(0.01, wSum);

  vec3 pA = p + vec3(0.12, -0.08, 0.0) + 0.04 * sin(vec3(t, t * 0.7, 0.0));
  vec3 pB = p + vec3(-0.16, 0.05, 0.0) + 0.05 * cos(vec3(t * 0.6, t, 0.0));
  vec3 pC = p + vec3(0.0, 0.18, 0.0) + 0.04 * sin(vec3(t * 0.9, t * 0.4, 0.0));
  vec3 pD = p + vec3(-0.1, -0.18, 0.0);

  float sphere = length(pA) - 0.22;
  vec3 boxP = abs(pB) - vec3(0.18, 0.1, 0.08);
  float box = length(max(boxP, 0.0)) + min(max(boxP.x, max(boxP.y, boxP.z)), 0.0);
  vec2 torusP = vec2(length(pC.xy) - 0.22, pC.z);
  float torus = length(torusP) - 0.05;
  float petalRing = abs(length(pD.xy) - 0.26) + abs(pD.z) - 0.03;

  float sphereGlow = 0.05 / (abs(sphere) + 0.0015);
  float boxGlow = 0.05 / (abs(box) + 0.0015);
  float torusGlow = 0.05 / (abs(torus) + 0.0015);
  float ringGlow = 0.05 / (abs(petalRing) + 0.0015);

  vec3 overlayCol = vec3(0.0);
  overlayCol += w.x * sphereGlow * mix(u_paletteA, u_extraColors[0], 0.5);
  overlayCol += w.y * boxGlow * mix(u_paletteB, u_extraColors[1], 0.5);
  overlayCol += w.z * torusGlow * mix(u_paletteC, u_extraColors[2], 0.5);
  overlayCol += w.w * ringGlow * mix(u_paletteB, u_paletteC, 0.5);
  col += overlayCol * overlayEnable * 1.4;

  vec3 volCol = vec3(0.0);
  float tVol = 0.0;
  float tVolMax = 5.0;
  float extraMask = clamp(u_extraCount / 6.0, 0.0, 1.0);
  for (int i = 0; i < 140; i++) {
    vec3 vp = ro + rd * tVol;
    float vd = mapScene(vp, t);
    float glowSharp = 0.02 / (abs(vd) + 0.0015);
    float rippleFreq = mix(1.2, 4.5, clamp(u_textureScale, 0.0, 1.0));
    float colorPhase = length(vp) * (rippleFreq + u_noiseScale) - t * 0.7;
    vec3 extraA = u_extraColors[0];
    vec3 extraB = u_extraColors[1];
    vec3 extraC = u_extraColors[2];
    vec3 extraD = u_extraColors[3];
    vec3 baseA = mix(u_paletteA, extraA, 0.85);
    vec3 baseB = mix(u_paletteB, extraB, 0.85);
    vec3 baseC = mix(u_paletteC, extraC, 0.85);
    vec3 baseD = mix(u_paletteB, extraD, 0.85);
    vec3 mixedAB = getGradient(colorPhase, baseA, baseB);
    vec3 mixedCD = getGradient(colorPhase + 1.7, baseC, baseD);
    vec3 glowColor = mix(mixedAB, mixedCD, extraMask) * (0.75 + 0.35 * extraMask);
    if (length(vp) < 0.1) glowColor += vec3(0.4, 0.3, 0.1);
    volCol += glowColor * glowSharp * 0.4;
    tVol += max(0.05, abs(vd) * 0.45);
    if (tVol > tVolMax) break;
  }

  vec3 finalCol = col * 0.2 + volCol;
  finalCol = finalCol / (1.0 + finalCol);

  float topMask = smoothstep(0.1, 1.0, uv.y);
  vec3 topTint = mix(u_paletteA, u_paletteB, 0.6);
  finalCol = mix(finalCol, topTint, topMask * 0.5);

  finalCol += vec3(0.12, 0.05, 0.15) * (uv.y + 1.0) * 0.2;
  finalCol = pow(finalCol, vec3(0.4545));
  gl_FragColor = vec4(finalCol, 1.0);
}
`;
