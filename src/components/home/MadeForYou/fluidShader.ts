export const fluidVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const fluidFragmentShader = `
precision highp float;
varying vec2 vUv;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_hover;
uniform float u_isPlaying;
uniform float u_seed;
uniform vec3 u_color1;           // Deep concentrated pigment
uniform vec3 u_color2;           // Vibrant watercolor body
uniform vec3 u_color3;           // Chromatic diffusion fringe
uniform vec3 u_colorHighlight;    // Translucent luminous filaments (lavender/cyan/rose/mint)
uniform vec3 u_colorBg;          // Deep crystal-dark water base

// 2D Rotation matrix
mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// Pseudo-random noise hash
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

// Cubic smooth value noise for continuous fluid flow
float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Multi-octave fractional Brownian motion with rotational curl
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = rot(0.72);
  for (int i = 0; i < 4; i++) {
    v += a * smoothNoise(p);
    p = m * p * 2.05 + vec2(0.25, 0.45);
    a *= 0.5;
  }
  return v;
}

void main() {
  // Dynamic motion time scaling: living, visible, flowing fluid
  // Gently accelerates when playing or hovered for responsive tactile feel
  float motionSpeed = 0.16 + u_hover * 0.06 + u_isPlaying * 0.08;
  float t = u_time * motionSpeed + u_seed * 19.34;

  vec2 uv = vUv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = uv - 0.5;
  p.x *= aspect;

  // ── 1. Interactive Cursor Vortex Stirring ──
  vec2 mTarget = (u_mouse - 0.5) * vec2(aspect, 1.0);
  vec2 toMouse = p - mTarget;
  float mDist = length(toMouse);
  vec2 mSwirl = vec2(-toMouse.y, toMouse.x) / (mDist + 0.12) * exp(-mDist * 3.0) * 0.10 * u_hover;
  p += mSwirl;

  // ── 2. Autonomous Internal Liquid Whirlpools & Vortices ──
  // Two shifting liquid eddy centers circulating the watercolor plumes
  vec2 v1 = vec2(sin(t * 0.45) * 0.30 * aspect, cos(t * 0.38) * 0.22);
  vec2 v2 = vec2(cos(t * 0.40 + 2.4) * 0.34 * aspect, sin(t * 0.48 + 1.8) * 0.24);

  vec2 dV1 = p - v1;
  vec2 dV2 = p - v2;
  float len1 = length(dV1);
  float len2 = length(dV2);

  // Smooth circular vorticity (curl without sink/compression)
  p += vec2(-dV1.y, dV1.x) / (len1 * 3.2 + 0.18) * 0.12 * sin(t * 0.75 + 0.5);
  p += vec2(-dV2.y, dV2.x) / (len2 * 3.5 + 0.18) * 0.10 * cos(t * 0.65 + 2.0);

  // Subtle rhythmic pulse when music is playing
  if (u_isPlaying > 0.1) {
    float rhythm = sin(t * 3.0) * 0.04 * u_isPlaying;
    p += p * rhythm;
  }

  // ── 3. Multi-Layer Fluid Advection (Flowing Currents & Tendrils) ──
  // Layer A: Broad underwater current vector
  vec2 currentDir = vec2(cos(t * 0.28), sin(t * 0.24)) * 0.35;
  vec2 q = vec2(
    fbm(p * 1.35 + currentDir + vec2(t * 0.22, -t * 0.16)),
    fbm(p * 1.35 - currentDir + vec2(-t * 0.18, t * 0.24) + vec2(5.2, 1.3))
  );

  // Layer B: Billowing watercolor plumes curling along currents
  vec2 plumeDrift = vec2(cos(t * 0.52 + 1.2), sin(t * 0.46 + 0.8)) * 0.35;
  vec2 r = vec2(
    fbm(p * 1.6 + 3.0 * q + plumeDrift + vec2(1.7, 9.2)),
    fbm(p * 1.6 + 3.0 * q + plumeDrift * 0.9 + vec2(8.3, 2.8))
  );

  // Layer C: Active micro-filaments & dissolving boundaries
  float inkField = fbm(p * 1.85 + 3.6 * r + vec2(t * 0.35, -t * 0.30));

  // ── 4. Shifting Ink Drops & Billowing Cloud Centers ──
  vec2 drop1 = vec2(sin(t * 0.42 + 0.5) * 0.28 * aspect, cos(t * 0.35 + 0.2) * 0.22);
  vec2 drop2 = vec2(cos(t * 0.38 + 2.8) * 0.30 * aspect, sin(t * 0.44 + 1.9) * 0.24);

  float dDrop1 = length(p + (r - 0.5) * 0.38 - drop1);
  float dDrop2 = length(p + (q - 0.5) * 0.42 - drop2);

  // Volumetric watercolor clouds
  float plume1 = smoothstep(0.82, 0.06, dDrop1 + (inkField - 0.5) * 0.42);
  float plume2 = smoothstep(0.85, 0.08, dDrop2 + (inkField - 0.5) * 0.38);

  float watercolorCore = clamp(plume1 * 1.12 + plume2 * 0.95, 0.0, 1.5);
  float fineWisps = pow(clamp(inkField, 0.0, 1.0), 1.8) * (plume1 * 0.65 + plume2 * 0.65);

  // ── 5. Color Dissolution & Chromatic Mixing ──
  vec3 col = u_colorBg;

  // Base concentration
  col = mix(col, u_color1, smoothstep(0.04, 0.50, watercolorCore * 0.78 + fineWisps * 0.38));

  // Flowing chromatic pigment body
  col = mix(col, u_color2, smoothstep(0.16, 0.80, watercolorCore));

  // Intense glowing diffusion fringes (chromatic boundary)
  float fringe = pow(smoothstep(0.10, 0.65, watercolorCore) * (1.0 - smoothstep(0.65, 1.15, watercolorCore)) * 2.3, 1.5);
  col = mix(col, u_color3, fringe * 0.95);

  // ── 6. Flowing Light Caustics & Traveling Surface Ribbons ──
  // Active ribbons of caustic light moving across the water
  float waveCaustic1 = sin(dot(p, vec2(1.2, 0.8)) * 3.4 - t * 0.85) * 0.5 + 0.5;
  float waveCaustic2 = cos(dot(p, vec2(-0.8, 1.1)) * 3.8 - t * 0.95 + 1.2) * 0.5 + 0.5;
  float movingCaustic = pow(waveCaustic1 * waveCaustic2, 2.8) * 0.38;
  col += u_colorHighlight * movingCaustic;

  // Luminous filaments catching light
  float filamentHighlight = pow(clamp(r.x * r.y * 3.4, 0.0, 1.0), 2.2) * (plume1 + plume2);
  col += u_colorHighlight * filamentHighlight * 0.45;

  // Soft moving watercolor bloom
  col += u_color3 * pow(clamp(fineWisps, 0.0, 1.0), 1.9) * 0.28;

  // Deep water outer edge vignette
  vec2 dEdge = uv * (1.0 - uv);
  float edgeDist = min(dEdge.x, dEdge.y);
  float edgeSoft = smoothstep(0.0, 0.16, edgeDist);
  col = mix(u_colorBg * 0.88, col, edgeSoft);

  // Breathing pulse
  float pulse = 0.98 + 0.02 * sin(t * 0.8);
  col *= pulse;

  gl_FragColor = vec4(col, 1.0);
}
`;
