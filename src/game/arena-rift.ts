// ── Arena Rift System ──────────────────────────────────────────
//
// Every few waves the arena undergoes a "rift shift" — a persistent
// environmental modifier that changes the rules of engagement.
// This creates wave-to-wave variety without new enemy content.
//
// Rifts trigger every 3 waves (offset from crisis events at 6, 12, …).
// A rift persists for 2 waves, then the arena returns to normal for
// 1 wave before the next rift rolls.

// ── Types ─────────────────────────────────────────────────────

export type ArenaRiftType =
  | 'void_collapse'
  | 'gravity_well'
  | 'emp_storm'
  | 'shockwave';

export interface ArenaRiftDef {
  id: ArenaRiftType;
  displayName: string;
  icon: string;
  description: string;
  color: string;         // accent color for HUD / visual ring
}

export interface VoidCollapseState {
  kind: 'void_collapse';
  /** Current effective radius (starts at full, shrinks). */
  currentRadius: number;
  /** Target radius at end of collapse. */
  minRadius: number;
  /** Seconds over which the collapse progresses. */
  collapseDuration: number;
  /** Time elapsed since the rift activated. */
  elapsed: number;
  /** Damage per second inflicted on ships outside the safe radius. */
  edgeDps: number;
}

export interface GravityWellState {
  kind: 'gravity_well';
  /** World position of the singularity. */
  wellX: number;
  wellZ: number;
  /** Gravitational pull strength. */
  strength: number;
  /** Radius within which the pull is felt. */
  influenceRadius: number;
  /** Time elapsed since activation. */
  elapsed: number;
  /** Whether the well slowly orbits the center. */
  orbitSpeed: number;
}

export interface EmpStormState {
  kind: 'emp_storm';
  /** Seconds between EMP pulses. */
  pulseInterval: number;
  /** Duration of shield-disable window. */
  disableDuration: number;
  /** Time elapsed since last pulse. */
  timeSinceLastPulse: number;
  /** Whether shields are currently disabled. */
  shieldsDisabled: boolean;
  /** Time remaining in current disable window. */
  disableTimer: number;
}

export interface ShockwaveState {
  kind: 'shockwave';
  /** Seconds between radial push waves. */
  waveInterval: number;
  /** Current radius of the expanding shockwave ring. */
  currentWaveRadius: number;
  /** Expansion speed of the wave ring. */
  waveSpeed: number;
  /** Force applied to ships/projectiles at the wave front. */
  pushForce: number;
  /** Time since last wave started. */
  timeSinceLastWave: number;
  /** Whether a wave is currently expanding. */
  waveActive: boolean;
  /** Time the current wave has been expanding. */
  waveElapsed: number;
}

export type ArenaRiftState =
  | VoidCollapseState
  | GravityWellState
  | EmpStormState
  | ShockwaveState;

export interface ArenaRiftActive {
  rift: ArenaRiftState;
  /** How many more waves this rift persists. */
  wavesRemaining: number;
}

// ── Catalog ───────────────────────────────────────────────────

export const ARENA_RIFTS: ArenaRiftDef[] = [
  {
    id: 'void_collapse',
    displayName: 'Void Collapse',
    icon: '🕳️',
    description: 'The arena is shrinking. Stay inside or take damage.',
    color: '#7c3aed',
  },
  {
    id: 'gravity_well',
    icon: '🌀',
    displayName: 'Gravity Well',
    description: 'A singularity warps projectile paths and pulls ships inward.',
    color: '#06b6d4',
  },
  {
    id: 'emp_storm',
    icon: '⚡',
    displayName: 'EMP Storm',
    description: 'Periodic pulses disable all shields briefly.',
    color: '#eab308',
  },
  {
    id: 'shockwave',
    icon: '💥',
    displayName: 'Shockwave',
    description: 'Expanding force rings push everything outward from center.',
    color: '#ef4444',
  },
];

const RIFT_BY_ID = Object.fromEntries(ARENA_RIFTS.map((r) => [r.id, r])) as Record<ArenaRiftType, ArenaRiftDef>;

export function getRiftDef(id: ArenaRiftType): ArenaRiftDef {
  return RIFT_BY_ID[id];
}

// ── Rift Selection ────────────────────────────────────────────
//
// Rifts activate every 3 waves: wave 3, 6, 9, 12, …
// Crisis events occupy 6, 12, 18 — if both collide, crisis wins.
// Each rift lasts 2 waves. Wave 3-4, 6-7 (but 6 = crisis), 9-10, etc.

/** Returns the wave number modulo for rift trigger (0-based: 3, 9, 15 …). */
const RIFT_PERIOD = 6;
const RIFT_OFFSET = 3;
const RIFT_DURATION = 2;

export function shouldTriggerRift(waveNumber: number, existingRift: ArenaRiftActive | null): boolean {
  if (existingRift != null) return false;
  // Rifts trigger on waves congruent to RIFT_OFFSET mod RIFT_PERIOD
  return ((waveNumber - RIFT_OFFSET) % RIFT_PERIOD === 0) && waveNumber >= RIFT_OFFSET;
}

export function isCrisisWave(waveNumber: number): boolean {
  return waveNumber > 0 && waveNumber % 6 === 0;
}

export function isRiftWave(waveNumber: number): boolean {
  if (isCrisisWave(waveNumber)) return false;
  return ((waveNumber - RIFT_OFFSET) % RIFT_PERIOD === 0) && waveNumber >= RIFT_OFFSET;
}

/** Available rift types that don't repeat the last one. */
export function rollRiftType(lastType: ArenaRiftType | null, seed: number): ArenaRiftType {
  const types: ArenaRiftType[] = ['void_collapse', 'gravity_well', 'emp_storm', 'shockwave'];
  if (lastType !== null) {
    const filtered = types.filter((t) => t !== lastType);
    return filtered[Math.floor(seed * filtered.length)];
  }
  return types[Math.floor(seed * types.length)];
}

// ── Rift Factory ──────────────────────────────────────────────

const BASE_ARENA_RADIUS = 17; // matches ARENA_RADIUS - 1

export function createRiftState(
  type: ArenaRiftType,
  seed: number,
): ArenaRiftState {
  const s = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 4973) * 0.5 + 0.5;
    return x - Math.floor(x);
  };

  switch (type) {
    case 'void_collapse':
      return {
        kind: 'void_collapse',
        currentRadius: BASE_ARENA_RADIUS,
        minRadius: BASE_ARENA_RADIUS * 0.45,
        collapseDuration: 25,
        elapsed: 0,
        edgeDps: 12,
      };

    case 'gravity_well': {
      const angle = s(1) * Math.PI * 2;
      const dist = 3 + s(2) * 5;
      return {
        kind: 'gravity_well',
        wellX: Math.cos(angle) * dist,
        wellZ: Math.sin(angle) * dist,
        strength: 6 + s(3) * 4,
        influenceRadius: BASE_ARENA_RADIUS * 0.9,
        elapsed: 0,
        orbitSpeed: 0.15 + s(4) * 0.2,
      };
    }

    case 'emp_storm':
      return {
        kind: 'emp_storm',
        pulseInterval: 7 + s(1) * 3,
        disableDuration: 2.5 + s(2),
        timeSinceLastPulse: 3 + s(3) * 2, // first pulse comes quickly
        shieldsDisabled: false,
        disableTimer: 0,
      };

    case 'shockwave':
      return {
        kind: 'shockwave',
        waveInterval: 5 + s(1) * 3,
        currentWaveRadius: 0,
        waveSpeed: 10 + s(2) * 5,
        pushForce: 8 + s(3) * 6,
        timeSinceLastWave: 2 + s(4), // first wave comes quickly
        waveActive: false,
        waveElapsed: 0,
      };
  }
}

// ── Update ────────────────────────────────────────────────────

export function updateRift(state: ArenaRiftState, dt: number): ArenaRiftState {
  switch (state.kind) {
    case 'void_collapse': {
      const elapsed = state.elapsed + dt;
      const t = Math.min(1, elapsed / state.collapseDuration);
      // Ease-in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const currentRadius = BASE_ARENA_RADIUS + (state.minRadius - BASE_ARENA_RADIUS) * eased;
      return { ...state, elapsed, currentRadius };
    }

    case 'gravity_well': {
      const elapsed = state.elapsed + dt;
      const orbitAngle = elapsed * state.orbitSpeed;
      const origDist = Math.hypot(state.wellX, state.wellZ);
      const origAngle = Math.atan2(state.wellZ, state.wellX);
      const newAngle = origAngle + orbitAngle * dt;
      return {
        ...state,
        elapsed,
        wellX: Math.cos(newAngle) * origDist,
        wellZ: Math.sin(newAngle) * origDist,
      };
    }

    case 'emp_storm': {
      let { timeSinceLastPulse, shieldsDisabled, disableTimer } = state;
      timeSinceLastPulse += dt;

      if (shieldsDisabled) {
        disableTimer -= dt;
        if (disableTimer <= 0) {
          shieldsDisabled = false;
          disableTimer = 0;
        }
      } else if (timeSinceLastPulse >= state.pulseInterval) {
        shieldsDisabled = true;
        disableTimer = state.disableDuration;
        timeSinceLastPulse = 0;
      }

      return { ...state, timeSinceLastPulse, shieldsDisabled, disableTimer };
    }

    case 'shockwave': {
      let { timeSinceLastWave, waveActive, waveElapsed, currentWaveRadius } = state;
      timeSinceLastWave += dt;

      if (waveActive) {
        waveElapsed += dt;
        currentWaveRadius += state.waveSpeed * dt;
        if (currentWaveRadius > BASE_ARENA_RADIUS * 1.2) {
          waveActive = false;
          currentWaveRadius = 0;
          waveElapsed = 0;
        }
      } else if (timeSinceLastWave >= state.waveInterval) {
        waveActive = true;
        currentWaveRadius = 1;
        waveElapsed = 0;
        timeSinceLastWave = 0;
      }

      return { ...state, timeSinceLastWave, waveActive, waveElapsed, currentWaveRadius };
    }
  }
}

// ── Queries ───────────────────────────────────────────────────

/** Get the effective arena clamp radius for this frame. */
export function getRiftArenaRadius(rift: ArenaRiftState | null): number {
  if (rift && rift.kind === 'void_collapse') {
    return rift.currentRadius;
  }
  return BASE_ARENA_RADIUS;
}

/** Get gravitational force vector for a position (for projectile deflection). */
export function getRiftGravityForce(
  rift: ArenaRiftState | null,
  x: number,
  z: number,
): { fx: number; fz: number } | null {
  if (!rift || rift.kind !== 'gravity_well') return null;
  const dx = rift.wellX - x;
  const dz = rift.wellZ - z;
  const dist = Math.max(1, Math.hypot(dx, dz));
  if (dist > rift.influenceRadius) return null;
  // Inverse-distance force (not inverse-square — more playable)
  const force = rift.strength / dist;
  return { fx: (dx / dist) * force, fz: (dz / dist) * force };
}

/** Whether shields should be forced off this frame. */
export function isRiftEmpActive(rift: ArenaRiftState | null): boolean {
  return rift?.kind === 'emp_storm' && rift.shieldsDisabled;
}

/** Get time until next EMP pulse (for HUD countdown). */
export function getEmpCountdown(rift: ArenaRiftState | null): number | null {
  if (!rift || rift.kind !== 'emp_storm') return null;
  if (rift.shieldsDisabled) return -rift.disableTimer;
  return rift.pulseInterval - rift.timeSinceLastPulse;
}

/** Get shockwave push force at a position. Ships/projectiles at the wave front get pushed. */
export function getRiftShockwaveForce(
  rift: ArenaRiftState | null,
  x: number,
  z: number,
): { fx: number; fz: number } | null {
  if (!rift || rift.kind !== 'shockwave' || !rift.waveActive) return null;
  const dist = Math.hypot(x, z);
  const waveFront = rift.currentWaveRadius;
  const thickness = 2.5; // how wide the push band is
  const delta = Math.abs(dist - waveFront);
  if (delta > thickness) return null;
  // Force falls off from center of the band
  const strength = rift.pushForce * (1 - delta / thickness);
  const angle = Math.atan2(z, x);
  return { fx: Math.cos(angle) * strength, fz: Math.sin(angle) * strength };
}

/** Whether a position is outside the safe zone during void collapse. */
export function isOutsideVoidCollapse(rift: ArenaRiftState | null, x: number, z: number): boolean {
  if (!rift || rift.kind !== 'void_collapse') return false;
  return Math.hypot(x, z) > rift.currentRadius;
}

/** Get the rift type from state. */
export function getRiftType(state: ArenaRiftState): ArenaRiftType {
  return state.kind;
}
