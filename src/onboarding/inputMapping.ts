import { ShaderParams, Vec3, Vec4 } from "../shader/types";

export type InputValue = number | boolean | string | string[];

export type InputSchema = Record<
  string,
  | { type: "range"; min: number; max: number; defaultValue?: number }
  | { type: "choice"; choices: string[]; defaultValue?: string }
  | { type: "multiSelect"; choices: string[]; defaultValue?: string[] }
  | { type: "boolean"; defaultValue?: boolean }
  | { type: "color"; defaultValue?: string }
>;

export const defaultOnboardingSchema: InputSchema = {
  screen1Intent: {
    type: "choice",
    choices: ["Exploration", "Challenge me", "Ideas & Solutions", "Validate & Listen", "Teach me"],
    defaultValue: "Exploration",
  },
  screen2Selections: {
    type: "multiSelect",
    choices: [
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
    ],
    defaultValue: [],
  },
  screen3Selections: {
    type: "multiSelect",
    choices: ["Warm", "Quirky", "Wise", "Direct", "Laid-back", "Humorous", "Sarcastic", "Nerdy"],
    defaultValue: [],
  },
  screen4Selections: {
    type: "multiSelect",
    choices: [
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
    ],
    defaultValue: [],
  },
  accentColor: { type: "color", defaultValue: "#f06d45" },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const normalizeRange = (value: number, min: number, max: number) => {
  if (max <= min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
};

const hexToRgb = (hex: string): Vec3 | null => {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r / 255, g / 255, b / 255];
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
};

const normalizeInput = (
  key: string,
  input: InputValue | undefined,
  schema: InputSchema
): { value: number; color?: Vec3 } => {
  const spec = schema[key];
  if (!spec) return { value: 0.5 };

  switch (spec.type) {
    case "range": {
      const raw =
        typeof input === "number"
          ? input
          : typeof spec.defaultValue === "number"
            ? spec.defaultValue
            : (spec.min + spec.max) / 2;
      return { value: normalizeRange(raw, spec.min, spec.max) };
    }
    case "choice": {
      const choice = typeof input === "string" ? input : spec.defaultValue;
      const index = choice ? Math.max(spec.choices.indexOf(choice), 0) : 0;
      return { value: spec.choices.length <= 1 ? 0.5 : index / (spec.choices.length - 1) };
    }
    case "multiSelect": {
      const rawList =
        Array.isArray(input) ? input : typeof input === "string" ? [input] : spec.defaultValue;
      const list = rawList ?? [];
      const count = list.length;
      const maxCount = spec.choices.length > 0 ? spec.choices.length : 6;
      const density = clamp(count / Math.max(maxCount, 1), 0, 1);
      const variety = list.length === 0 ? 0 : hashString([...list].sort().join("|"));
      return { value: clamp(0.65 * density + 0.35 * variety, 0, 1) };
    }
    case "boolean": {
      const bool =
        typeof input === "boolean"
          ? input
          : typeof spec.defaultValue === "boolean"
            ? spec.defaultValue
            : false;
      return { value: bool ? 1 : 0 };
    }
    case "color": {
      const color =
        typeof input === "string"
          ? hexToRgb(input)
          : spec.defaultValue
            ? hexToRgb(spec.defaultValue)
            : null;
      return { value: color ? 1 : 0.5, color: color ?? undefined };
    }
    default:
      return { value: 0.5 };
  }
};

const normalizeMultiSelect = (
  key: string,
  input: InputValue | undefined,
  schema: InputSchema
): { density: number; variety: number } => {
  const spec = schema[key];
  if (!spec || spec.type !== "multiSelect") return { density: 0.5, variety: 0.5 };
  const rawList =
    Array.isArray(input) ? input : typeof input === "string" ? [input] : spec.defaultValue;
  const list = rawList ?? [];
  const maxCount = spec.choices.length > 0 ? spec.choices.length : 6;
  const density = clamp(list.length / Math.max(maxCount, 1), 0, 1);
  const variety = list.length === 0 ? 0 : hashString([...list].sort().join("|"));
  return { density, variety };
};

const blendVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

const toRgbFromHsv = (h: number, s: number, v: number): Vec3 => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: Vec3 = [0, 0, 0];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
};

const colorFromLabel = (label: string): Vec3 => {
  const h = hashString(label) * 360;
  return toRgbFromHsv(h, 0.65, 0.95);
};

const normalizeWeights = (weights: Vec4, fallback: Vec4): Vec4 => {
  const total = weights[0] + weights[1] + weights[2] + weights[3];
  if (total <= 0.0001) return fallback;
  return [weights[0] / total, weights[1] / total, weights[2] / total, weights[3] / total];
};

const paletteFromNormalized = (warmth: number, calm: number, colorOverride?: Vec3) => {
  const warmA: Vec3 = [0.95, 0.45, 0.2];
  const warmB: Vec3 = [0.9, 0.8, 0.4];
  const warmC: Vec3 = [0.2, 0.05, 0.02];

  const coolA: Vec3 = [0.2, 0.45, 0.95];
  const coolB: Vec3 = [0.35, 0.75, 0.85];
  const coolC: Vec3 = [0.02, 0.05, 0.2];

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
    a: baseA.map((c) => clamp(c * calmShift, 0, 1)) as Vec3,
    b: baseB,
    c: baseC,
  };
};

export const mapOnboardingInputsToShaderParams = (
  inputs: Record<string, InputValue>,
  schema: InputSchema = defaultOnboardingSchema
): ShaderParams => {
  const screen1Intent =
    typeof inputs.screen1Intent === "string"
      ? inputs.screen1Intent
      : (schema.screen1Intent as { defaultValue?: string } | undefined)?.defaultValue;

  const baseAxes = {
    Exploration: { energy: 0.6, calm: 0.5, novelty: 0.9, focus: 0.4, warmth: 0.55, structure: 0.35 },
    "Challenge me": { energy: 0.95, calm: 0.2, novelty: 0.7, focus: 0.7, warmth: 0.4, structure: 0.6 },
    "Ideas & Solutions": { energy: 0.55, calm: 0.55, novelty: 0.6, focus: 0.8, warmth: 0.5, structure: 0.85 },
    "Validate & Listen": { energy: 0.35, calm: 0.9, novelty: 0.35, focus: 0.6, warmth: 0.85, structure: 0.5 },
    "Teach me": { energy: 0.5, calm: 0.65, novelty: 0.4, focus: 0.75, warmth: 0.6, structure: 0.8 },
  };

  const fallbackAxes = { energy: 0.55, calm: 0.55, novelty: 0.55, focus: 0.55, warmth: 0.55, structure: 0.55 };
  const base = (screen1Intent && baseAxes[screen1Intent as keyof typeof baseAxes]) || fallbackAxes;

  const screen2 = normalizeMultiSelect("screen2Selections", inputs.screen2Selections, schema);
  const screen3 = normalizeMultiSelect("screen3Selections", inputs.screen3Selections, schema);
  const screen4 = normalizeMultiSelect("screen4Selections", inputs.screen4Selections, schema);

  const energy = clamp(base.energy + 0.25 * screen2.density + 0.15 * screen4.density, 0, 1);
  const calm = clamp(base.calm + 0.2 * (1 - screen2.density) + 0.1 * screen3.variety, 0, 1);
  const novelty = clamp(base.novelty + 0.3 * screen2.variety + 0.2 * screen4.variety, 0, 1);
  const focus = clamp(base.focus + 0.35 * screen3.density - 0.15 * screen2.variety, 0, 1);
  const warmth = clamp(base.warmth + 0.2 * screen4.density, 0, 1);
  const structure = clamp(base.structure + 0.35 * screen3.density, 0, 1);

  const texture = clamp(0.4 + 0.3 * screen2.variety + 0.3 * screen4.variety, 0, 1);
  const colorChoice = normalizeInput("accentColor", inputs.accentColor, schema);

  const seedInput = inputs.seed;
  const seed =
    typeof seedInput === "number"
      ? seedInput
      : typeof seedInput === "string"
        ? hashString(seedInput) * 1000
        : hashString(JSON.stringify(inputs)) * 1000;

  const palette = paletteFromNormalized(warmth, calm, colorChoice.color);
  const screen2Selections = Array.isArray(inputs.screen2Selections)
    ? inputs.screen2Selections
    : [];
  const selectionColors = screen2Selections.map(colorFromLabel);
  const extraColors = selectionColors;

  const intentPalettes: Record<string, { a: Vec3; b: Vec3; c: Vec3 }> = {
    Exploration: { a: [0.82, 0.35, 0.78], b: [0.95, 0.45, 0.88], c: [0.28, 0.06, 0.24] },
    "Challenge me": { a: [0.7, 0.9, 0.6], b: [0.5, 0.8, 0.4], c: [0.2, 0.3, 0.1] },
    "Ideas & Solutions": { a: [0.95, 0.6, 0.25], b: [0.9, 0.5, 0.2], c: [0.3, 0.12, 0.04] },
    "Validate & Listen": { a: [0.2, 0.45, 0.25], b: [0.25, 0.6, 0.3], c: [0.05, 0.15, 0.08] },
    "Teach me": { a: [0.9, 0.4, 0.35], b: [0.98, 0.5, 0.4], c: [0.35, 0.12, 0.08] },
  };
  const intentPalette = screen1Intent ? intentPalettes[screen1Intent] : undefined;
  const themedPalette = intentPalette
    ? {
        a: blendVec3(palette.a, intentPalette.a, 0.7),
        b: blendVec3(palette.b, intentPalette.b, 0.7),
        c: blendVec3(palette.c, intentPalette.c, 0.7),
      }
    : palette;

  const screen3Selections = Array.isArray(inputs.screen3Selections)
    ? inputs.screen3Selections
    : [];
  let textureWeights: Vec4 = [0, 0, 0, 0];
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
  let motionWeights: Vec4 = [0, 0, 0, 0];
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
    seed,
    noiseScale: lerp(0.6, 4.2, 0.35 * structure + 0.65 * novelty),
    warp: lerp(0.0, 1.4, 0.6 * novelty + 0.4 * energy),
    speed: lerp(0.05, 0.75, energy),
    contrast: lerp(0.8, 1.6, 0.5 * focus + 0.5 * structure),
    hueShift: lerp(-0.25, 0.25, warmth),
    grain: lerp(0.0, 0.25, 0.5 * novelty + 0.5 * texture),
    paletteA: themedPalette.a,
    paletteB: themedPalette.b,
    paletteC: themedPalette.c,
    extraColors,
    extraCount: Math.min(extraColors.length, 21),
    textureWeights,
    textureScale,
    motionWeights,
  };
};
