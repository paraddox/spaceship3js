// ── Combat Atmosphere System ─────────────────────────────────────
//
// A reactive environmental layer that makes the arena itself feel alive.
// Reads existing game state (music intensity, combo, HP, overdrive, boss)
// and outputs smooth visual parameters — no new content needed.
//
// Every existing system compounds here: higher combo → brighter grid,
// low HP → danger vignette, overdrive → purple atmosphere, boss → crimson.

// ── Types ──────────────────────────────────────────────────────

export interface AtmosphereInput {
  /** Music director intensity (0–5). */
  intensity: number;
  /** Player HP fraction (0–1). */
  hpFraction: number;
  /** Current combo kill count. */
  comboKills: number;
  /** Whether overdrive is active. */
  overdriveActive: boolean;
  /** Whether a boss is alive. */
  bossAlive: boolean;
  /** Whether near-miss bullet-time is active. */
  nearMissActive: boolean;
  /** Time in seconds since the run started. */
  elapsed: number;
  /** Whether the wave is currently active (enemies spawned). */
  waveActive: boolean;
}

export interface AtmosphereState {
  // ── Grid (floor circuit lines) ──
  /** Grid emissive intensity 0–1. Invisible at 0, blazing at 1. */
  gridBrightness: number;
  /** Grid pulse phase — oscillates 0→1 at a rate driven by intensity. */
  gridPulsePhase: number;
  /** Grid base color hue (0–360). */
  gridHue: number;

  // ── Arena ring ──
  /** Ring color as hex string. */
  ringColor: string;
  /** Ring pulse intensity 0–1 (throb on boss, flash on wave clear). */
  ringPulse: number;

  // ── Ambient particles (nebula dust) ──
  /** How fast to spawn ambient particles (0 = none, 1 = heavy). */
  nebulaRate: number;
  /** Nebula color as hex. */
  nebulaColor: string;
  /** How much nebula particles are affected by player velocity. */
  nebulaDrift: number;

  // ── Star field ──
  /** Star brightness multiplier (0.5–2.0). */
  starBrightness: number;
  /** Star twinkle rate multiplier. */
  starTwinkle: number;

  // ── CSS vignette layers ──
  /** Danger vignette opacity 0–1 (red, when low HP). */
  dangerVignette: number;
  /** Combo shimmer opacity 0–1 (gold, when high combo). */
  comboShimmer: number;
  /** Overdrive tint opacity 0–1 (purple). */
  overdriveVignette: number;

  // ── Fog / depth ──
  /** Scene fog near distance. */
  fogNear: number;
  /** Scene fog far distance. */
  fogFar: number;

  // ── Smoothed internal values (not part of public API) ──
  _smoothIntensity: number;
  _smoothHpFraction: number;
  _smoothCombo: number;
}

// ── Color helpers ──────────────────────────────────────────────

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// Palette anchors keyed by intensity
const GRID_COLORS: Record<number, [number, number, number]> = {
  0: [30, 58, 87],     // idle blue-gray
  1: [30, 58, 87],
  2: [59, 130, 246],   // calm blue
  3: [251, 191, 36],   // amber
  4: [249, 115, 22],   // orange
  5: [239, 68, 68],    // crimson
};

const RING_COLORS: Record<number, [number, number, number]> = {
  0: [31, 58, 87],
  1: [31, 58, 87],
  2: [59, 130, 246],
  3: [251, 191, 36],
  4: [249, 115, 22],
  5: [220, 38, 38],
};

const NEBULA_COLORS: Record<number, [number, number, number]> = {
  0: [30, 41, 59],     // slate
  1: [30, 58, 95],     // deep blue
  2: [59, 130, 246],   // blue
  3: [217, 119, 6],    // warm amber
  4: [168, 85, 247],   // purple (overdrive)
  5: [185, 28, 28],    // crimson boss
};

function sampleGradient(
  map: Record<number, [number, number, number]>,
  value: number,
): [number, number, number] {
  const v = Math.max(0, Math.min(5, value));
  const lo = Math.floor(v);
  const hi = Math.min(5, lo + 1);
  if (lo === hi) return map[lo];
  const t = v - lo;
  return lerpColor(map[lo], map[hi], t);
}

// ── Factory ────────────────────────────────────────────────────

export function createAtmosphere(): AtmosphereState {
  return {
    gridBrightness: 0,
    gridPulsePhase: 0,
    gridHue: 210,
    ringColor: '#1f3a57',
    ringPulse: 0,
    nebulaRate: 0,
    nebulaColor: '#1e3a5f',
    nebulaDrift: 0.3,
    starBrightness: 0.7,
    starTwinkle: 0.5,
    dangerVignette: 0,
    comboShimmer: 0,
    overdriveVignette: 0,
    fogNear: 40,
    fogFar: 70,
    _smoothIntensity: 0,
    _smoothHpFraction: 1,
    _smoothCombo: 0,
  };
}

// ── Tick ───────────────────────────────────────────────────────

const SMOOTH_RATE = 2.5;  // how fast atmosphere responds (lower = smoother)

export function tickAtmosphere(state: AtmosphereState, input: AtmosphereInput, dt: number): AtmosphereState {
  const t = Math.min(1, dt * SMOOTH_RATE);

  // Smooth the raw inputs
  const si = state._smoothIntensity + (input.intensity - state._smoothIntensity) * t;
  const shp = state._smoothHpFraction + (input.hpFraction - state._smoothHpFraction) * t;
  const sc = state._smoothCombo + (input.comboKills - state._smoothCombo) * t;

  // ── Grid ──
  // Brightness ramps with intensity, pulses during combat
  const baseGridBright = si / 5;
  const pulseSpeed = 1 + si * 0.8;
  const gridPulsePhase = (state.gridPulsePhase + dt * pulseSpeed) % 1;
  const pulseAmount = si > 1 ? Math.sin(gridPulsePhase * Math.PI * 2) * 0.15 * (si / 5) : 0;
  const gridBrightness = Math.max(0, Math.min(1, baseGridBright + pulseAmount));

  // ── Ring ──
  const ringRgb = sampleGradient(RING_COLORS, input.bossAlive ? 5 : si);
  // Boss pulse: faster, harder throb
  const ringPulseSpeed = input.bossAlive ? 4 : 2;
  const ringPulseAmount = input.bossAlive ? 0.4 : (si > 2 ? 0.2 : 0);
  const ringPulse = input.bossAlive
    ? 0.5 + 0.5 * Math.sin(input.elapsed * ringPulseSpeed * Math.PI * 2)
    : ringPulseAmount > 0
      ? 0.5 + 0.5 * Math.sin(input.elapsed * ringPulseSpeed * Math.PI * 2) * ringPulseAmount
      : 0;

  // ── Nebula ──
  let nebulaIntensity = si;
  // Override: low HP pushes nebula toward red
  if (shp < 0.3 && input.waveActive) {
    nebulaIntensity = Math.max(nebulaIntensity, 3.5);
  }
  // Override: overdrive pushes to purple
  if (input.overdriveActive) {
    nebulaIntensity = 4;
  }
  const nebulaRgb = sampleGradient(NEBULA_COLORS, input.overdriveActive ? 4 : nebulaIntensity);
  const nebulaRate = 0.2 + (si / 5) * 0.8;  // 0.2 idle → 1.0 max
  const nebulaDrift = 0.2 + (si / 5) * 0.6;

  // ── Stars ──
  const starBrightness = input.nearMissActive ? 1.8 : (0.5 + si / 5 * 0.8);
  const starTwinkle = input.nearMissActive ? 0.2 : (0.3 + si / 5 * 0.7);

  // ── Vignettes ──
  // Danger: fades in below 30% HP
  const dangerTarget = shp < 0.3 && input.waveActive ? Math.pow((0.3 - shp) / 0.3, 1.5) : 0;
  const dangerVignette = state.dangerVignette + (dangerTarget - state.dangerVignette) * t * 1.5;

  // Combo shimmer: visible above 5 kills
  const comboTarget = sc >= 5 ? Math.min(1, (sc - 5) / 15) * (0.5 + 0.5 * Math.sin(input.elapsed * 3)) : 0;
  const comboShimmer = state.comboShimmer + (comboTarget - state.comboShimmer) * t * 2;

  // Overdrive vignette
  const overdriveTarget = input.overdriveActive ? 0.5 + 0.2 * Math.sin(input.elapsed * 6) : 0;
  const overdriveVignette = state.overdriveVignette + (overdriveTarget - state.overdriveVignette) * t * 3;

  // ── Fog ──
  // Tighten fog slightly at high intensity for claustrophobic boss feel
  const fogFar = input.bossAlive ? 50 + si * 2 : 55 + (1 - si / 5) * 20;
  const fogNear = fogFar * 0.55;

  return {
    gridBrightness,
    gridPulsePhase,
    gridHue: 210, // not used yet — reserved for future hue shifts
    ringColor: rgbToHex(ringRgb[0], ringRgb[1], ringRgb[2]),
    ringPulse,
    nebulaRate,
    nebulaColor: rgbToHex(nebulaRgb[0], nebulaRgb[1], nebulaRgb[2]),
    nebulaDrift,
    starBrightness,
    starTwinkle,
    dangerVignette,
    comboShimmer,
    overdriveVignette,
    fogNear,
    fogFar,
    _smoothIntensity: si,
    _smoothHpFraction: shp,
    _smoothCombo: sc,
  };
}
