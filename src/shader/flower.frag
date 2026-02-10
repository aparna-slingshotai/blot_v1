// Fragment shader for the Blot flower visualization.
// Standalone .frag export of the shader from ./templates.ts
//
// ═══════════════════════════════════════════════════════════════════
// FLUTTER INTEGRATION GUIDE
// ═══════════════════════════════════════════════════════════════════
//
// This is standard GLSL ES — works in editors, WebGL, and Flutter (Skia backend).
//
// For Flutter Impeller backend, apply these changes:
//   1. Add:    #include <flutter/runtime_effect.glsl>
//   2. Replace: gl_FragCoord  ->  FlutterFragCoord()
//   3. Replace: gl_FragColor  ->  out vec4 fragColor (declared before main)
//   4. Remove:  precision highp float;
//
// ═══════════════════════════════════════════════════════════════════
// UNIFORM REFERENCE — what each input controls
// ═══════════════════════════════════════════════════════════════════
//
// u_resolution (vec2) — Canvas size in pixels [width, height].
//   Set to the widget size. Required for correct aspect ratio.
//
// u_time (float) — Elapsed time in seconds since animation start.
//   Drives all animation. Increment each frame (e.g. via Ticker).
//
// u_seed (float) — Random seed for variation.
//   Range: 0 – 1000. Different seeds produce different flower shapes
//   while keeping the same overall character. Typically hashed from
//   user inputs so each user gets a unique flower.
//
// u_noiseScale (float) — Petal texture detail / complexity.
//   Range: 0.6 – 4.2. Low = smooth petals, high = intricate detail.
//   Affects the ripple frequency in the volumetric glow rendering.
//
// u_warp (float) — Camera distortion amount.
//   Range: 0.0 – 1.4. Controls how much the camera pitch oscillates.
//   Higher = more dynamic, swaying viewpoint.
//
// u_speed (float) — Overall animation speed.
//   Range: 0.05 – 0.75. Controls time multiplier and camera yaw.
//   Low = slow, meditative; high = fast, energetic.
//
// u_contrast (float) — Reserved for future use.
//   Range: 0.8 – 1.6. Declared but not currently read in main().
//
// u_hueShift (float) — Reserved for future use.
//   Range: -0.25 – 0.25. Declared but not currently read in main().
//
// u_grain (float) — Reserved for future use.
//   Range: 0.0 – 0.25. Declared but not currently read in main().
//
// u_paletteA (vec3) — Primary flower color (RGB, each channel 0–1).
//   Dominant petal color, top tint, and volumetric glow base.
//   Example warm: (0.95, 0.45, 0.2)  Example cool: (0.2, 0.45, 0.95)
//
// u_paletteB (vec3) — Secondary flower color (RGB, 0–1).
//   Blended into petal shading and overlay glow accents.
//   Example warm: (0.9, 0.8, 0.4)  Example cool: (0.35, 0.75, 0.85)
//
// u_paletteC (vec3) — Center / core color (RGB, 0–1).
//   The innermost flower center and torus overlay glow.
//   Example warm: (0.2, 0.05, 0.02)  Example cool: (0.02, 0.05, 0.2)
//
// u_extraColors (vec3[21]) — Up to 21 additional accent colors (RGB, 0–1).
//   Used in overlay glow effects and volumetric color cycling.
//   Unused slots can be left at (0, 0, 0). Only the first
//   u_extraCount colors are blended in.
//
// u_extraCount (float) — Number of active extra colors.
//   Range: 0 – 21. At 6+ the volumetric glow is fully saturated.
//   Controls the blend strength: mask = clamp(count / 6, 0, 1).
//
// u_textureWeights (vec4) — Overlay shape blend [warm, direct, wise, quirky].
//   Each component 0–1, normalized so they sum to ~1.
//   Controls which of 4 overlay glow shapes are visible:
//     .x (warm)   → sphere glow
//     .y (direct) → box glow
//     .z (wise)   → torus glow
//     .w (quirky) → petal ring glow
//   Default if unsure: (0.35, 0.25, 0.2, 0.2)
//
// u_textureScale (float) — Volumetric ripple frequency.
//   Range: 0.2 – 1.0. Mapped to ripple freq 1.2–4.5 internally.
//   Low = fewer, broader ripples; high = tight, detailed ripples.
//
// u_motionWeights (vec4) — Animation rhythm blend [nature, energy, pop, mystery].
//   NOT normalized (values accumulate). Controls oscillation mix:
//     .x (nature)  → slow sine   (period ~25s)
//     .y (energy)  → medium sine (period ~10s)
//     .z (pop)     → fast sine   (period ~6s)
//     .w (mystery) → slow sine with phase offset
//   Default if unsure: (0.5, 0.2, 0.15, 0.15)
//
// ═══════════════════════════════════════════════════════════════════
// DART shader.setFloat() INDEX MAP  (92 floats total)
// ═══════════════════════════════════════════════════════════════════
//
//   Index  0-1  : u_resolution      (vec2  — 2 floats)
//   Index  2    : u_time            (float)
//   Index  3    : u_seed            (float)
//   Index  4    : u_noiseScale      (float)
//   Index  5    : u_warp            (float)
//   Index  6    : u_speed           (float)
//   Index  7    : u_contrast        (float)
//   Index  8    : u_hueShift        (float)
//   Index  9    : u_grain           (float)
//   Index  10-12: u_paletteA        (vec3  — 3 floats)
//   Index  13-15: u_paletteB        (vec3  — 3 floats)
//   Index  16-18: u_paletteC        (vec3  — 3 floats)
//   Index  19-81: u_extraColors     (vec3[21] — 63 floats)
//   Index  82   : u_extraCount      (float)
//   Index  83-86: u_textureWeights  (vec4  — 4 floats)
//   Index  87   : u_textureScale    (float)
//   Index  88-91: u_motionWeights   (vec4  — 4 floats)
//   ─────────────────────────────────────────────────
//   Total: 92 floats
//
// ═══════════════════════════════════════════════════════════════════
// SAMPLE DART USAGE
// ═══════════════════════════════════════════════════════════════════
//
//   final program = await FragmentProgram.fromAsset('shaders/flower.frag');
//   final shader  = program.fragmentShader();
//
//   // System uniforms (set every frame)
//   shader.setFloat(0, size.width);    // u_resolution.x
//   shader.setFloat(1, size.height);   // u_resolution.y
//   shader.setFloat(2, elapsedSec);    // u_time
//
//   // Creative uniforms (set once or when config changes)
//   shader.setFloat(3, 42.0);          // u_seed
//   shader.setFloat(4, 2.0);           // u_noiseScale
//   shader.setFloat(5, 0.7);           // u_warp
//   shader.setFloat(6, 0.4);           // u_speed
//   shader.setFloat(7, 1.0);           // u_contrast  (reserved)
//   shader.setFloat(8, 0.0);           // u_hueShift  (reserved)
//   shader.setFloat(9, 0.0);           // u_grain     (reserved)
//
//   // Palette colors (RGB, 0–1)
//   shader.setFloat(10, 0.82); shader.setFloat(11, 0.35); shader.setFloat(12, 0.78); // u_paletteA
//   shader.setFloat(13, 0.95); shader.setFloat(14, 0.45); shader.setFloat(15, 0.88); // u_paletteB
//   shader.setFloat(16, 0.28); shader.setFloat(17, 0.06); shader.setFloat(18, 0.24); // u_paletteC
//
//   // Extra colors — fill indices 19..81 (3 floats per color, 21 slots)
//   for (int i = 0; i < 21; i++) {
//     shader.setFloat(19 + i * 3,     colors[i].r);
//     shader.setFloat(19 + i * 3 + 1, colors[i].g);
//     shader.setFloat(19 + i * 3 + 2, colors[i].b);
//   }
//   shader.setFloat(82, 5.0);          // u_extraCount (number of active colors)
//
//   // Texture / overlay weights
//   shader.setFloat(83, 0.35); shader.setFloat(84, 0.25);  // u_textureWeights.xy
//   shader.setFloat(85, 0.20); shader.setFloat(86, 0.20);  // u_textureWeights.zw
//   shader.setFloat(87, 0.5);          // u_textureScale
//
//   // Motion weights
//   shader.setFloat(88, 0.5);  shader.setFloat(89, 0.2);   // u_motionWeights.xy
//   shader.setFloat(90, 0.15); shader.setFloat(91, 0.15);  // u_motionWeights.zw
//
//   canvas.drawRect(Offset.zero & size, Paint()..shader = shader);

precision highp float;

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
