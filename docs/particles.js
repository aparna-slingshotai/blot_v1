/*
    Multi-pass curl noise particle shader.
    Ported from Shadertoy (al-ro, MIT License 2023).

    4 render passes per frame:
      Buffer A – camera / mouse tracking (ping-pong, self-read)
      Buffer B – particle simulation via curl noise (ping-pong, self-read)
      Buffer C – particle rendering at half resolution (reads A, B, self for trails)
      Image   – ACES tone mapping + gamma (reads C, renders to screen)
*/

// ═══════════════════════════════════════════════════════════════════════════
// GLSL Sources
// ═══════════════════════════════════════════════════════════════════════════

const COMMON_GLSL = `
// --- Common code (al-ro, MIT 2023) ---
#define RENDER_SCALE (iResolution.x < 2048.0 ? 0.5 : 0.25)
#define PI 3.14159
#define TWO_PI (2.0 * PI)
#define GAMMA 2.2
#define INV_GAMMA (1.0 / GAMMA)

void pixarONB(vec3 n, out vec3 b1, out vec3 b2){
  float sign_ = n.z >= 0.0 ? 1.0 : -1.0;
  float a = -1.0 / (sign_ + n.z);
  float b = n.x * n.y * a;
  b1 = vec3(1.0 + sign_ * n.x * n.x * a, sign_ * b, -sign_ * n.x);
  b2 = vec3(b, sign_ + n.y * n.y * a, -n.y);
}

vec3 gamma(vec3 col){
  return pow(col, vec3(INV_GAMMA));
}

float saturate(float x){
  return clamp(x, 0.0, 1.0);
}
`;

const VERTEX_SOURCE = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ─── Buffer A: Camera / mouse tracking ───────────────────────────────────
const BUFFER_A_SOURCE = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform vec4 iMouse;
uniform int iFrame;
uniform sampler2D iChannel0; // self (previous frame)

out vec4 fragColor;

${COMMON_GLSL}

#define CAMERA_DIST 16.0

void main() {
  vec2 fragCoord = gl_FragCoord.xy;

  if ((fragCoord.x == 0.5) && (fragCoord.y < 4.0)) {

    vec4 oldData = texelFetch(iChannel0, ivec2(0, 0), 0).xyzw;
    vec2 oldPolarAngles = oldData.xy;
    vec2 oldMouse = oldData.zw;
    vec2 polarAngles = vec2(0);
    vec2 mouse = iMouse.xy / iResolution.xy;

    float angleEps = 0.01;
    float mouseDownLastFrame = texelFetch(iChannel0, ivec2(0, 3), 0).x;

    if (iMouse.z > 0.0 && mouseDownLastFrame > 0.0) {
      vec2 mouseMove = mouse - oldMouse;
      polarAngles = oldPolarAngles + vec2(5.0, 3.0) * mouseMove;
    } else {
      polarAngles = oldPolarAngles;
    }

    polarAngles.x = mod(polarAngles.x, 2.0 * PI - angleEps);
    polarAngles.y = min(PI - angleEps, max(angleEps, polarAngles.y));

    if (fragCoord == vec2(0.5, 0.5)) {
      if (iFrame < 10) {
        polarAngles = vec2(2.9, 1.7);
        mouse = vec2(0);
      }
      fragColor = vec4(polarAngles, mouse);
    }

    if (fragCoord == vec2(0.5, 1.5)) {
      vec3 cameraPos = normalize(vec3(
        -cos(polarAngles.x) * sin(polarAngles.y),
         cos(polarAngles.y),
        -sin(polarAngles.x) * sin(polarAngles.y)));
      fragColor = vec4(CAMERA_DIST * cameraPos, 1.0);
    }

    if (fragCoord == vec2(0.5, 2.5)) {
      float resolutionChangeFlag = 0.0;
      vec2 oldResolution = texelFetch(iChannel0, ivec2(0, 2), 0).yz;
      if (iResolution.xy != oldResolution) {
        resolutionChangeFlag = 1.0;
      }
      fragColor = vec4(resolutionChangeFlag, iResolution.xy, 1.0);
    }

    if (fragCoord == vec2(0.5, 3.5)) {
      if (iMouse.z > 0.0) {
        fragColor = vec4(vec3(1.0), 1.0);
      } else {
        fragColor = vec4(vec3(0.0), 1.0);
      }
    }
  }
}
`;

// ─── Buffer B: Particle simulation (curl noise) ─────────────────────────
const BUFFER_B_SOURCE = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform sampler2D iChannel0; // self (previous frame)

out vec4 fragColor;

${COMMON_GLSL}

const float speed = 3.0;
const float scale = 0.15;
const float particleCount = 2048.0;
const float boundingRadius = 10.0;
const float spawnRadius = 4.0;

// ── Noise ──
vec3 fade(vec3 t){
  return (t * t * t) * (t * (t * 6.0 - 15.0) + 10.0);
}

vec3 hash(vec3 p3){
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return 2.0 * fract((p3.xxy + p3.yxx) * p3.zyx) - 1.0;
}

vec3 hash32(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float noise(vec3 p){
  p += 1e-4 * iTime;
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = fade(f);

  return mix(
    mix( mix( dot(hash(i + vec3(0,0,0)), f - vec3(0,0,0)),
              dot(hash(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
         mix( dot(hash(i + vec3(0,1,0)), f - vec3(0,1,0)),
              dot(hash(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
    mix( mix( dot(hash(i + vec3(0,0,1)), f - vec3(0,0,1)),
              dot(hash(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
         mix( dot(hash(i + vec3(0,1,1)), f - vec3(0,1,1)),
              dot(hash(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}

// ── Curl ──
vec3 computeCurl(vec3 p){
  const float eps = 1e-4;
  float dx = noise(p + vec3(eps,0,0)) - noise(p - vec3(eps,0,0));
  float dy = noise(p + vec3(0,eps,0)) - noise(p - vec3(0,eps,0));
  float dz = noise(p + vec3(0,0,eps)) - noise(p - vec3(0,0,eps));
  vec3 noiseGrad0 = vec3(dx, dy, dz) / (2.0 * eps);

  p += 1000.5;
  dx = noise(p + vec3(eps,0,0)) - noise(p - vec3(eps,0,0));
  dy = noise(p + vec3(0,eps,0)) - noise(p - vec3(0,eps,0));
  dz = noise(p + vec3(0,0,eps)) - noise(p - vec3(0,0,eps));
  vec3 noiseGrad1 = vec3(dx, dy, dz) / (2.0 * eps);

  return normalize(cross(noiseGrad0, noiseGrad1));
}

// ── Position ──
vec4 getInitialPosition(vec2 fragCoord){
  return vec4(spawnRadius * (2.0 * hash32(fragCoord) - 1.0), 0.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;

  if ((floor(fragCoord.y) * iResolution.x + floor(fragCoord.x)) < particleCount) {
    if (iFrame == 0) {
      fragColor = getInitialPosition(fragCoord);
    } else {
      float iTimeLastFrame = texelFetch(iChannel0, ivec2(0, 0), 0).x;
      float dT = iTime - iTimeLastFrame;

      vec4 oldData = texelFetch(iChannel0, ivec2(fragCoord), 0);
      vec3 oldPos = oldData.rgb;
      oldPos += speed * dT * computeCurl(scale * oldPos);
      vec4 newPos = vec4(oldPos, oldData.w + dT);

      if (length(newPos) > boundingRadius) {
        newPos = getInitialPosition(fragCoord + iTime);
      }
      fragColor = newPos;
    }
  } else {
    fragColor = vec4(vec3(0), 1.0);
  }

  if (fragCoord == vec2(0.5, 0.5)) {
    fragColor = vec4(iTime);
  }
}
`;

// ─── Buffer C: Particle rendering ────────────────────────────────────────
const BUFFER_C_SOURCE = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;
uniform sampler2D iChannel0; // Buffer A
uniform sampler2D iChannel1; // Buffer B
uniform sampler2D iChannel2; // self (previous frame, for trails)
uniform vec3 iChannelResolution1; // Buffer B resolution

out vec4 fragColor;

${COMMON_GLSL}

const int particleCount = 300;
const float boundingRadius = 10.0;
const bool trails = false;

// ── Camera ──
vec3 rayDirection(float fieldOfView, vec2 fragCoord, vec2 resolution) {
  vec2 xy = fragCoord - resolution / 2.0;
  float z = (0.5 * resolution.y) / tan(radians(fieldOfView) / 2.0);
  return normalize(vec3(xy, -z));
}

mat3 lookAt(vec3 camera, vec3 targetDir, vec3 up){
  vec3 zaxis = normalize(targetDir);
  vec3 xaxis = normalize(cross(zaxis, up));
  vec3 yaxis = cross(xaxis, zaxis);
  return mat3(xaxis, yaxis, -zaxis);
}

// ── Intersection ──
vec3 intersectCoordSys(in vec3 ro, in vec3 rd, vec3 dc, vec3 du, vec3 dv){
  vec3 oc = ro - dc;
  return vec3(
    dot(cross(du, dv), oc),
    dot(cross(oc, du), rd),
    dot(cross(dv, oc), rd)) /
    dot(cross(dv, du), rd);
}

vec2 intersectAABB(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
  vec3 tMin = (boxMin - rayOrigin) / rayDir;
  vec3 tMax = (boxMax - rayOrigin) / rayDir;
  vec3 t1 = min(tMin, tMax);
  vec3 t2 = max(tMin, tMax);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  return vec2(tNear, tFar);
}

bool insideAABB(vec3 p, vec3 minCorner, vec3 maxCorner){
  float eps = 1e-4;
  return (p.x > minCorner.x-eps) && (p.y > minCorner.y-eps) && (p.z > minCorner.z-eps) &&
         (p.x < maxCorner.x+eps) && (p.y < maxCorner.y+eps) && (p.z < maxCorner.z+eps);
}

// ── Colour ──
float getGlow(float dist, float radius, float intensity){
  dist = max(dist, 1e-6);
  return pow(radius/dist, intensity);
}

vec3 getColour(float t){
  t += 0.15 * iTime;
  vec3 a = vec3(0.65);
  vec3 b = 1.0 - a;
  vec3 c = vec3(1.0,1.0,1.0);
  vec3 d = vec3(0.15,0.5,0.75);
  return a + b * cos(TWO_PI * (c * t + d));
}

// ── Geometry ──
vec3 traceParticles(vec3 org, vec3 rayDir){
  vec3 n = -rayDir;
  vec3 tangent;
  vec3 bitangent;
  pixarONB(n, tangent, bitangent);
  tangent = normalize(tangent);
  bitangent = normalize(bitangent);
  vec3 col = vec3(0);
  float size = 16.0;

  vec3 intersection;
  float d;
  vec3 glow;
  ivec2 uv;
  vec4 data;
  vec3 pos;
  float len;
  float s;

  for (int i = 1; i < particleCount; i++) {
    uv = ivec2(int(mod(float(i), iChannelResolution1.x)),
                    i / int(iChannelResolution1.x));
    data = texelFetch(iChannel1, uv, 0);
    pos = data.xyz;
    len = length(pos);
    s = smoothstep(boundingRadius, 0.0, len);
    if (s < 1e-5) {
      continue;
    }

    intersection = intersectCoordSys(org, rayDir, pos, tangent, bitangent);
    d = dot(intersection.yz, intersection.yz);
    if (d < size) {
      float glowSize = mix(1.0, 4.0, smoothstep(4.0, 0.0, len)) *
                        mix(0.001, 0.01, 0.5 + 0.5 * sin(13.0 * iTime + float(i)/6.0));
      vec3 tone = getColour(float(i) / (3.4 * float(particleCount)));
      glow = tone * getGlow(d, glowSize, mix(1.0, 0.9, s));
      float lifeTime = smoothstep(0.0, 0.5, data.w);
      col += lifeTime * s * glow * smoothstep(size, 0.0, d);
    }
  }

  return col;
}

// ── Render ──
void main() {
  vec2 fragCoord = gl_FragCoord.xy;

  if (fragCoord.x > iResolution.x * RENDER_SCALE ||
      fragCoord.y > iResolution.y * RENDER_SCALE) {
    fragColor = vec4(0);
  } else {
    vec3 rayDir = rayDirection(60.0, fragCoord, iResolution.xy * RENDER_SCALE);

    vec3 cameraPos = texelFetch(iChannel0, ivec2(0, 1), 0).xyz;
    vec3 targetDir = -cameraPos;
    vec3 up = vec3(0.0, 1.0, 0.0);
    mat3 viewMatrix = lookAt(cameraPos, targetDir, up);

    rayDir = normalize(viewMatrix * rayDir);
    vec3 col = vec3(0.0, 0.01, 0.02);

    vec2 intersections = intersectAABB(cameraPos, rayDir,
                                        vec3(-boundingRadius), vec3(boundingRadius));
    if (intersections.x > 0.0 && (intersections.x < intersections.y) ||
        insideAABB(cameraPos, vec3(-boundingRadius), vec3(boundingRadius))) {
      col += traceParticles(cameraPos, rayDir);
    }

    if (trails) {
      if (iMouse.z < 0.0) {
        vec3 oldCol = texelFetch(iChannel2, ivec2(fragCoord), 0).rgb;
        oldCol = clamp(oldCol, 0.0, 2.0);
        col = mix(oldCol, col, 0.45);
      }
    }

    fragColor = vec4(col, 1.0);
  }
}
`;

// ─── Image: Final composite (tone map + gamma) ──────────────────────────
const IMAGE_SOURCE = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform sampler2D iChannel0; // Buffer C

out vec4 fragColor;

${COMMON_GLSL}

vec3 ACESFilm(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution.xy;

  vec3 col = texture(iChannel0, RENDER_SCALE * uv).rgb;
  col = ACESFilm(col);
  col = gamma(col);

  fragColor = vec4(col, 1.0);
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// WebGL2 Helpers
// ═══════════════════════════════════════════════════════════════════════════

const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + error);
  }
  return shader;
};

const createProgram = (gl, vertexSource, fragmentSource) => {
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("Program link error: " + error);
  }
  return program;
};

const createFloatTexture = (gl, w, h) => {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
};

const createPingPong = (gl, w, h) => {
  const texA = createFloatTexture(gl, w, h);
  const texB = createFloatTexture(gl, w, h);

  const fboA = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);

  const fboB = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    textures: [texA, texB],
    fbos: [fboA, fboB],
    idx: 0,
    width: w,
    height: h,
    writeFBO() { return this.fbos[this.idx]; },
    readTex()  { return this.textures[1 - this.idx]; },
    swap()     { this.idx = 1 - this.idx; },
    destroy(gl) {
      gl.deleteTexture(this.textures[0]);
      gl.deleteTexture(this.textures[1]);
      gl.deleteFramebuffer(this.fbos[0]);
      gl.deleteFramebuffer(this.fbos[1]);
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════════════

const init = () => {
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl2", { antialias: false });
  if (!gl) {
    document.body.innerHTML = "<p style='color:#fff;padding:2em'>WebGL2 is not supported in this browser.</p>";
    return;
  }

  const extFloat = gl.getExtension("EXT_color_buffer_float");
  if (!extFloat) {
    document.body.innerHTML = "<p style='color:#fff;padding:2em'>EXT_color_buffer_float is not supported.</p>";
    return;
  }

  // ── Compile programs ──
  const progA   = createProgram(gl, VERTEX_SOURCE, BUFFER_A_SOURCE);
  const progB   = createProgram(gl, VERTEX_SOURCE, BUFFER_B_SOURCE);
  const progC   = createProgram(gl, VERTEX_SOURCE, BUFFER_C_SOURCE);
  const progImg = createProgram(gl, VERTEX_SOURCE, IMAGE_SOURCE);

  // ── Cache uniform locations ──
  const uA = {
    iResolution: gl.getUniformLocation(progA, "iResolution"),
    iMouse:      gl.getUniformLocation(progA, "iMouse"),
    iFrame:      gl.getUniformLocation(progA, "iFrame"),
    iChannel0:   gl.getUniformLocation(progA, "iChannel0"),
  };
  const uB = {
    iResolution: gl.getUniformLocation(progB, "iResolution"),
    iTime:       gl.getUniformLocation(progB, "iTime"),
    iFrame:      gl.getUniformLocation(progB, "iFrame"),
    iChannel0:   gl.getUniformLocation(progB, "iChannel0"),
  };
  const uC = {
    iResolution:          gl.getUniformLocation(progC, "iResolution"),
    iTime:                gl.getUniformLocation(progC, "iTime"),
    iFrame:               gl.getUniformLocation(progC, "iFrame"),
    iMouse:               gl.getUniformLocation(progC, "iMouse"),
    iChannel0:            gl.getUniformLocation(progC, "iChannel0"),
    iChannel1:            gl.getUniformLocation(progC, "iChannel1"),
    iChannel2:            gl.getUniformLocation(progC, "iChannel2"),
    iChannelResolution1:  gl.getUniformLocation(progC, "iChannelResolution1"),
  };
  const uImg = {
    iResolution: gl.getUniformLocation(progImg, "iResolution"),
    iChannel0:   gl.getUniformLocation(progImg, "iChannel0"),
  };

  // ── Fullscreen quad VAO ──
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
    gl.STATIC_DRAW);
  // Bind attribute 0 for all programs (a_position is at location 0 for all)
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ── Create ping-pong FBOs ──
  const sizeCanvas = () => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(canvas.clientWidth  * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
  };
  sizeCanvas();

  let w = canvas.width;
  let h = canvas.height;

  let bufA = createPingPong(gl, w, h);
  let bufB = createPingPong(gl, w, h);
  let bufC = createPingPong(gl, w, h); // full size – shader clips via RENDER_SCALE

  // ── Mouse state (Shadertoy convention) ──
  const mouse = { x: 0, y: 0, z: -1, w: -1 };

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const x = (e.clientX - rect.left) * ratio;
    const y = canvas.height - (e.clientY - rect.top) * ratio;
    mouse.x = x; mouse.y = y;
    mouse.z = x; mouse.w = y;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (mouse.z > 0) {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      mouse.x = (e.clientX - rect.left) * ratio;
      mouse.y = canvas.height - (e.clientY - rect.top) * ratio;
    }
  });

  canvas.addEventListener("mouseup", () => {
    mouse.z = -Math.abs(mouse.z);
    mouse.w = -Math.abs(mouse.w);
  });

  // Touch support
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const x = (t.clientX - rect.left) * ratio;
    const y = canvas.height - (t.clientY - rect.top) * ratio;
    mouse.x = x; mouse.y = y;
    mouse.z = x; mouse.w = y;
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (mouse.z > 0) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      mouse.x = (t.clientX - rect.left) * ratio;
      mouse.y = canvas.height - (t.clientY - rect.top) * ratio;
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    mouse.z = -Math.abs(mouse.z);
    mouse.w = -Math.abs(mouse.w);
  }, { passive: false });

  // ── Resize ──
  let needsResize = false;
  window.addEventListener("resize", () => { needsResize = true; });

  const handleResize = () => {
    sizeCanvas();
    w = canvas.width;
    h = canvas.height;
    bufA.destroy(gl); bufA = createPingPong(gl, w, h);
    bufB.destroy(gl); bufB = createPingPong(gl, w, h);
    bufC.destroy(gl); bufC = createPingPong(gl, w, h);
    frame = 0;
    needsResize = false;
  };

  // ── Frame state ──
  let frame = 0;
  const startTime = performance.now();

  // ── Render loop ──
  const render = (now) => {
    if (needsResize) handleResize();

    const time = (now - startTime) / 1000.0;

    // ── Pass A: Camera / mouse tracking ──
    gl.useProgram(progA);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bufA.writeFBO());
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufA.readTex());
    gl.uniform1i(uA.iChannel0, 0);
    gl.uniform3f(uA.iResolution, w, h, 1.0);
    gl.uniform4f(uA.iMouse, mouse.x, mouse.y, mouse.z, mouse.w);
    gl.uniform1i(uA.iFrame, frame);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    bufA.swap();

    // ── Pass B: Particle simulation ──
    gl.useProgram(progB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bufB.writeFBO());
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufB.readTex());
    gl.uniform1i(uB.iChannel0, 0);
    gl.uniform3f(uB.iResolution, w, h, 1.0);
    gl.uniform1f(uB.iTime, time);
    gl.uniform1i(uB.iFrame, frame);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    bufB.swap();

    // ── Pass C: Particle rendering ──
    gl.useProgram(progC);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bufC.writeFBO());
    gl.viewport(0, 0, w, h);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufA.readTex());
    gl.uniform1i(uC.iChannel0, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bufB.readTex());
    gl.uniform1i(uC.iChannel1, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, bufC.readTex());
    gl.uniform1i(uC.iChannel2, 2);

    gl.uniform3f(uC.iResolution, w, h, 1.0);
    gl.uniform1f(uC.iTime, time);
    gl.uniform1i(uC.iFrame, frame);
    gl.uniform4f(uC.iMouse, mouse.x, mouse.y, mouse.z, mouse.w);
    gl.uniform3f(uC.iChannelResolution1, bufB.width, bufB.height, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    bufC.swap();

    // ── Image pass: Tone map + gamma → screen ──
    gl.useProgram(progImg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufC.readTex());
    gl.uniform1i(uImg.iChannel0, 0);
    gl.uniform3f(uImg.iResolution, w, h, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    frame++;
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
};

init();
