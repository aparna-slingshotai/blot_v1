const SCREEN1_INTENTS = [
  "Exploration",
  "Challenge me",
  "Ideas & Solutions",
  "Validate & Listen",
  "Teach me",
];

const SCREEN2_OPTIONS = [
  "Parenting Concerns",
  "LGBTQ+ Identity",
  "Neurodivergence",
  "Christianity",
  "Career",
  "Islam",
  "Judaism",
  "Buddhism",
  "Hinduism",
  "Mindfulness",
  "Self-esteem",
  "ACT",
  "Skills",
  "Stress",
  "Grief",
  "Low mood",
  "Productivity",
  "Loneliness",
  "Relationship Problems",
  "Jainism",
  "Sikhism",
];

const SCREEN3_OPTIONS = [
  "Warm",
  "Quirky",
  "Wise",
  "Direct",
  "Laid-back",
  "Humorous",
  "Sarcastic",
  "Nerdy",
];

const SCREEN4_OPTIONS = [
  "Sports",
  "Pop culture",
  "Fitness",
  "Gardening",
  "Books",
  "Tarot",
  "Movies",
  "Video games",
  "Animals",
  "Nature",
  "Cooking",
  "Mythology",
  "Philosophy",
  "History",
  "Music",
  "Photography",
  "Yoga",
  "Memes",
  "Dreams",
  "Board games",
];

const fragmentShaderSource = `precision highp float;

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
  for (int i = 0; i < 140; i++) {
    vec3 vp = ro + rd * tVol;
    float vd = mapScene(vp, t);
    float glowSharp = 0.02 / (abs(vd) + 0.0015);
    float rippleFreq = mix(1.2, 4.5, clamp(u_textureScale, 0.0, 1.0));
    float colorPhase = length(vp) * (rippleFreq + u_noiseScale) - t * 0.7;
    vec3 extraA = u_extraColors[0];
    vec3 extraB = u_extraColors[1];
    vec3 glowColor = getGradient(colorPhase, mix(u_paletteA, extraA, 0.6), mix(u_paletteB, extraB, 0.6)) * 0.6;
    if (length(vp) < 0.1) glowColor += vec3(0.4, 0.3, 0.1);
    volCol += glowColor * glowSharp * 0.4;
    tVol += max(0.05, abs(vd) * 0.45);
    if (tVol > tVolMax) break;
  }

  vec3 finalCol = col * 0.2 + volCol;
  finalCol = finalCol / (1.0 + finalCol);
  finalCol += vec3(0.12, 0.05, 0.15) * (uv.y + 1.0) * 0.2;
  finalCol = pow(finalCol, vec3(0.4545));
  gl_FragColor = vec4(finalCol, 1.0);
}
`;

const vertexShaderSource = `attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, t) => a + (b - a) * t;

const hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
};

const toRgbFromHsv = (h, s, v) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb = [0, 0, 0];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
};

const colorFromLabel = (label) => {
  const h = hashString(label) * 360;
  return toRgbFromHsv(h, 0.65, 0.95);
};

const normalizeWeights = (weights, fallback) => {
  const total = weights[0] + weights[1] + weights[2] + weights[3];
  if (total <= 0.0001) return fallback;
  return [weights[0] / total, weights[1] / total, weights[2] / total, weights[3] / total];
};

const normalizeMultiSelect = (list, maxCount) => {
  const safeList = Array.isArray(list) ? list : [];
  const density = clamp(safeList.length / Math.max(maxCount, 1), 0, 1);
  const variety = safeList.length === 0 ? 0 : hashString([...safeList].sort().join("|"));
  return { density, variety };
};

const blendVec3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const paletteFromNormalized = (warmth, calm, colorOverride) => {
  const warmA = [0.95, 0.45, 0.2];
  const warmB = [0.9, 0.8, 0.4];
  const warmC = [0.2, 0.05, 0.02];

  const coolA = [0.2, 0.45, 0.95];
  const coolB = [0.35, 0.75, 0.85];
  const coolC = [0.02, 0.05, 0.2];

  const baseA = blendVec3(coolA, warmA, warmth);
  const baseB = blendVec3(coolB, warmB, warmth);
  const baseC = blendVec3(coolC, warmC, warmth);

  if (colorOverride) {
    return {
      a: blendVec3(baseA, colorOverride, 0.6),
      b: blendVec3(baseB, colorOverride, 0.3),
      c: baseC,
    };
  }

  const calmShift = lerp(0.85, 1.15, 1 - calm);
  return {
    a: baseA.map((c) => clamp(c * calmShift, 0, 1)),
    b: baseB,
    c: baseC,
  };
};

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r / 255, g / 255, b / 255];
};

const mapInputsToParams = (inputs) => {
  const baseAxes = {
    Exploration: { energy: 0.6, calm: 0.5, novelty: 0.9, focus: 0.4, warmth: 0.55, structure: 0.35 },
    "Challenge me": { energy: 0.95, calm: 0.2, novelty: 0.7, focus: 0.7, warmth: 0.4, structure: 0.6 },
    "Ideas & Solutions": { energy: 0.55, calm: 0.55, novelty: 0.6, focus: 0.8, warmth: 0.5, structure: 0.85 },
    "Validate & Listen": { energy: 0.35, calm: 0.9, novelty: 0.35, focus: 0.6, warmth: 0.85, structure: 0.5 },
    "Teach me": { energy: 0.5, calm: 0.65, novelty: 0.4, focus: 0.75, warmth: 0.6, structure: 0.8 },
  };
  const fallbackAxes = { energy: 0.55, calm: 0.55, novelty: 0.55, focus: 0.55, warmth: 0.55, structure: 0.55 };
  const base = baseAxes[inputs.screen1Intent] || fallbackAxes;

  const screen2 = normalizeMultiSelect(inputs.screen2Selections, SCREEN2_OPTIONS.length);
  const screen3 = normalizeMultiSelect(inputs.screen3Selections, SCREEN3_OPTIONS.length);
  const screen4 = normalizeMultiSelect(inputs.screen4Selections, SCREEN4_OPTIONS.length);

  const energy = clamp(base.energy + 0.25 * screen2.density + 0.15 * screen4.density, 0, 1);
  const calm = clamp(base.calm + 0.2 * (1 - screen2.density) + 0.1 * screen3.variety, 0, 1);
  const novelty = clamp(base.novelty + 0.3 * screen2.variety + 0.2 * screen4.variety, 0, 1);
  const focus = clamp(base.focus + 0.35 * screen3.density - 0.15 * screen2.variety, 0, 1);
  const warmth = clamp(base.warmth + 0.2 * screen4.density, 0, 1);
  const structure = clamp(base.structure + 0.35 * screen3.density, 0, 1);
  const texture = clamp(0.4 + 0.3 * screen2.variety + 0.3 * screen4.variety, 0, 1);

  const seed = inputs.seed
    ? typeof inputs.seed === "number"
      ? inputs.seed
      : hashString(String(inputs.seed)) * 1000
    : hashString(JSON.stringify(inputs)) * 1000;

  const palette = paletteFromNormalized(warmth, calm, inputs.accentColor);
  const screen2Selections = Array.isArray(inputs.screen2Selections)
    ? inputs.screen2Selections
    : [];
  const selectionColors = screen2Selections.map(colorFromLabel);
  const extraColors = selectionColors;

  const screen3Selections = Array.isArray(inputs.screen3Selections)
    ? inputs.screen3Selections
    : [];
  let textureWeights = [0, 0, 0, 0];
  screen3Selections.forEach((label) => {
    switch (label) {
      case "Warm":
        textureWeights = [textureWeights[0] + 1, textureWeights[1], textureWeights[2], textureWeights[3]];
        break;
      case "Quirky":
        textureWeights = [textureWeights[0], textureWeights[1], textureWeights[2], textureWeights[3] + 1];
        break;
      case "Wise":
        textureWeights = [textureWeights[0], textureWeights[1], textureWeights[2] + 1, textureWeights[3]];
        break;
      case "Direct":
        textureWeights = [textureWeights[0], textureWeights[1] + 1, textureWeights[2], textureWeights[3]];
        break;
      case "Laid-back":
        textureWeights = [textureWeights[0] + 1, textureWeights[1], textureWeights[2], textureWeights[3] + 1];
        break;
      case "Humorous":
        textureWeights = [textureWeights[0] + 1, textureWeights[1], textureWeights[2], textureWeights[3]];
        break;
      case "Sarcastic":
        textureWeights = [textureWeights[0], textureWeights[1] + 1, textureWeights[2], textureWeights[3]];
        break;
      case "Nerdy":
        textureWeights = [textureWeights[0], textureWeights[1] + 1, textureWeights[2] + 1, textureWeights[3]];
        break;
      default:
        break;
    }
  });
  textureWeights = normalizeWeights(textureWeights, [0.35, 0.25, 0.2, 0.2]);

  const screen4Selections = Array.isArray(inputs.screen4Selections)
    ? inputs.screen4Selections
    : [];
  let motionWeights = [0, 0, 0, 0];
  screen4Selections.forEach((label) => {
    switch (label) {
      case "Sports":
      case "Fitness":
      case "Video games":
      case "Music":
        motionWeights = [motionWeights[0], motionWeights[1] + 1, motionWeights[2], motionWeights[3]];
        break;
      case "Pop culture":
      case "Memes":
      case "Board games":
        motionWeights = [motionWeights[0], motionWeights[1], motionWeights[2] + 1, motionWeights[3]];
        break;
      case "Nature":
      case "Yoga":
      case "Gardening":
      case "Cooking":
      case "Animals":
      case "Photography":
        motionWeights = [motionWeights[0] + 1, motionWeights[1], motionWeights[2], motionWeights[3]];
        break;
      case "Tarot":
      case "Mythology":
      case "Dreams":
        motionWeights = [motionWeights[0], motionWeights[1], motionWeights[2], motionWeights[3] + 1];
        break;
      case "Books":
      case "Philosophy":
      case "History":
      case "Movies":
        motionWeights = [motionWeights[0] + 1, motionWeights[1], motionWeights[2], motionWeights[3] + 1];
        break;
      default:
        break;
    }
  });
  motionWeights = normalizeWeights(motionWeights, [0.5, 0.2, 0.15, 0.15]);
  const textureScale = clamp(0.2 + 0.8 * screen3.density, 0, 1);

  return {
    u_seed: seed,
    u_noiseScale: lerp(0.6, 4.2, 0.35 * structure + 0.65 * novelty),
    u_warp: lerp(0.0, 1.4, 0.6 * novelty + 0.4 * energy),
    u_speed: lerp(0.05, 0.75, energy),
    u_contrast: lerp(0.8, 1.6, 0.5 * focus + 0.5 * structure),
    u_hueShift: lerp(-0.25, 0.25, warmth),
    u_grain: lerp(0.0, 0.25, 0.5 * novelty + 0.5 * texture),
    u_paletteA: palette.a,
    u_paletteB: palette.b,
    u_paletteC: palette.c,
    u_extraColors: extraColors,
    u_extraCount: Math.min(extraColors.length, 21),
    u_textureWeights: textureWeights,
    u_textureScale: textureScale,
    u_motionWeights: motionWeights,
  };
};

const setupSelect = (selectEl, options) => {
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    selectEl.appendChild(opt);
  });
};

const setupCheckboxes = (container, options, onChange) => {
  container.innerHTML = "";
  options.forEach((option) => {
    const label = document.createElement("label");
    label.className = "chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option;
    const text = document.createElement("span");
    text.textContent = option;
    label.appendChild(input);
    label.appendChild(text);
    label.addEventListener("click", (event) => {
      if (event.target !== input) {
        input.checked = !input.checked;
      }
      label.classList.toggle("checked", input.checked);
      onChange();
    });
    input.addEventListener("change", () => {
      label.classList.toggle("checked", input.checked);
      onChange();
    });
    container.appendChild(label);
  });
};

const gatherSelections = (container) =>
  Array.from(container.querySelectorAll("input[type='checkbox']:checked")).map(
    (input) => input.value
  );

const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
};

const createProgram = (gl, vertexSource, fragmentSource) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(error);
  }
  return program;
};

const init = () => {
  const selectIntent = document.getElementById("screen1Intent");
  const screen2Container = document.getElementById("screen2Options");
  const screen3Container = document.getElementById("screen3Options");
  const screen4Container = document.getElementById("screen4Options");
  const accentColorInput = document.getElementById("accentColor");
  const seedInput = document.getElementById("seed");
  const canvas = document.getElementById("shader-canvas");

  setupSelect(selectIntent, SCREEN1_INTENTS);
  selectIntent.value = SCREEN1_INTENTS[0];
  setupCheckboxes(screen2Container, SCREEN2_OPTIONS, () => updateUniforms());
  setupCheckboxes(screen3Container, SCREEN3_OPTIONS, () => updateUniforms());
  setupCheckboxes(screen4Container, SCREEN4_OPTIONS, () => updateUniforms());

  const gl = canvas.getContext("webgl", { antialias: true });
  if (!gl) {
    canvas.replaceWith("WebGL not supported in this browser.");
    return;
  }

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  gl.useProgram(program);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniformLocations = {
    u_resolution: gl.getUniformLocation(program, "u_resolution"),
    u_time: gl.getUniformLocation(program, "u_time"),
    u_seed: gl.getUniformLocation(program, "u_seed"),
    u_noiseScale: gl.getUniformLocation(program, "u_noiseScale"),
    u_warp: gl.getUniformLocation(program, "u_warp"),
    u_speed: gl.getUniformLocation(program, "u_speed"),
    u_contrast: gl.getUniformLocation(program, "u_contrast"),
    u_hueShift: gl.getUniformLocation(program, "u_hueShift"),
    u_grain: gl.getUniformLocation(program, "u_grain"),
    u_paletteA: gl.getUniformLocation(program, "u_paletteA"),
    u_paletteB: gl.getUniformLocation(program, "u_paletteB"),
    u_paletteC: gl.getUniformLocation(program, "u_paletteC"),
    u_extraColors: gl.getUniformLocation(program, "u_extraColors[0]"),
    u_extraCount: gl.getUniformLocation(program, "u_extraCount"),
    u_textureWeights: gl.getUniformLocation(program, "u_textureWeights"),
    u_textureScale: gl.getUniformLocation(program, "u_textureScale"),
    u_motionWeights: gl.getUniformLocation(program, "u_motionWeights"),
  };

  const updateUniforms = () => {
    const accent = hexToRgb(accentColorInput.value);
    const inputs = {
      screen1Intent: selectIntent.value,
      screen2Selections: gatherSelections(screen2Container),
      screen3Selections: gatherSelections(screen3Container),
      screen4Selections: gatherSelections(screen4Container),
      accentColor: accent,
      seed: seedInput.value.trim(),
    };
    const params = mapInputsToParams(inputs);
    gl.uniform1f(uniformLocations.u_seed, params.u_seed);
    gl.uniform1f(uniformLocations.u_noiseScale, params.u_noiseScale);
    gl.uniform1f(uniformLocations.u_warp, params.u_warp);
    gl.uniform1f(uniformLocations.u_speed, params.u_speed);
    gl.uniform1f(uniformLocations.u_contrast, params.u_contrast);
    gl.uniform1f(uniformLocations.u_hueShift, params.u_hueShift);
    gl.uniform1f(uniformLocations.u_grain, params.u_grain);
    gl.uniform3fv(uniformLocations.u_paletteA, params.u_paletteA);
    gl.uniform3fv(uniformLocations.u_paletteB, params.u_paletteB);
    gl.uniform3fv(uniformLocations.u_paletteC, params.u_paletteC);
    if (uniformLocations.u_extraColors) {
      const flatColors = new Float32Array(63);
      params.u_extraColors.forEach((color, index) => {
        if (index >= 21) return;
        flatColors[index * 3] = color[0];
        flatColors[index * 3 + 1] = color[1];
        flatColors[index * 3 + 2] = color[2];
      });
      gl.uniform3fv(uniformLocations.u_extraColors, flatColors);
    }
    gl.uniform1f(uniformLocations.u_extraCount, params.u_extraCount);
    gl.uniform4fv(uniformLocations.u_textureWeights, params.u_textureWeights);
    gl.uniform1f(uniformLocations.u_textureScale, params.u_textureScale);
    gl.uniform4fv(uniformLocations.u_motionWeights, params.u_motionWeights);
  };

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(clientWidth * ratio);
    canvas.height = Math.floor(clientHeight * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniformLocations.u_resolution, canvas.width, canvas.height);
  };

  window.addEventListener("resize", resize);
  selectIntent.addEventListener("change", updateUniforms);
  accentColorInput.addEventListener("input", updateUniforms);
  seedInput.addEventListener("input", updateUniforms);

  resize();
  updateUniforms();

  let start = performance.now();
  const render = (now) => {
    const time = (now - start) / 1000;
    gl.uniform1f(uniformLocations.u_time, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
};

init();
