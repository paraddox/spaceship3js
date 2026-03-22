// ── Combat Pickup System ─────────────────────────────────────────
//
// Enemies drop pickups when killed. The player collects them by
// flying nearby. Pickups provide instant benefits (shield restore,
// module repair) or temporary buffs (damage boost, fire rate boost).
//
// Drop rates and buff durations scale with endless mode wave number.
//
// Pickup types:
// - shield_cell: Instantly restores 30% of max shield.
// - repair_kit: Repairs one damaged module to 75% of max HP.
//   Prioritizes destroyed modules first, then most-damaged alive modules.
// - power_surge: 6s buff — 40% increased damage output.
// - rapid_fire: 5s buff — 50% increased fire rate.
// - salvage: Repairs one destroyed module to full HP (rare, ~8% of drops).

import type { ModuleRuntimeState } from './simulation';

export type PickupKind = 'shield_cell' | 'repair_kit' | 'power_surge' | 'rapid_fire' | 'salvage';

export interface PickupState {
  id: string;
  kind: PickupKind;
  x: number;
  z: number;
  active: boolean;
  ttl: number;            // seconds until despawn
  maxTtl: number;
  bobPhase: number;       // visual bobbing animation phase
  attractionRange: number; // magnetic pull radius
}

export interface ActiveBuff {
  kind: 'power_surge' | 'rapid_fire';
  remaining: number;      // seconds remaining
  duration: number;       // total duration (for HUD display)
}

export interface PickupCollectionResult {
  collected: boolean;
  kind: PickupKind | null;
  shieldRestore: number;
  repairTarget: ModuleRuntimeState | null;
  buffGained: ActiveBuff | null;
}

// ── Pickup Configuration ────────────────────────────────────────

const PICKUP_CONFIG: Record<PickupKind, { weight: number; color: string; label: string }> = {
  shield_cell:  { weight: 30, color: '#38bdf8', label: 'Shield Cell' },
  repair_kit:   { weight: 25, color: '#4ade80', label: 'Repair Kit' },
  power_surge:  { weight: 22, color: '#f59e0b', label: 'Power Surge' },
  rapid_fire:   { weight: 18, color: '#f472b6', label: 'Rapid Fire' },
  salvage:      { weight: 5,  color: '#c084fc', label: 'Salvage' },
};

const ATTRACT_RANGE = 2.5;
const COLLECT_RANGE = 1.0;
const PICKUP_TTL = 12;
const SHIELD_RESTORE_FRACTION = 0.3;
const REPAIR_HP_FRACTION = 0.75;

// ── Pickup Spawning ─────────────────────────────────────────────

let pickupIdCounter = 0;

export function rollPickupDrop(enemyRadius: number, waveNumber: number): PickupKind | null {
  // Base drop rate: 35%, scales up slightly in endless mode
  const dropRate = 0.35 + Math.min(waveNumber * 0.008, 0.2);
  if (Math.random() > dropRate) return null;

  // Weighted random selection
  const totalWeight = Object.values(PICKUP_CONFIG).reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const [kind, config] of Object.entries(PICKUP_CONFIG)) {
    roll -= config.weight;
    if (roll <= 0) return kind as PickupKind;
  }

  return 'shield_cell';
}

export function createPickup(kind: PickupKind, x: number, z: number): PickupState {
  return {
    id: `pickup-${++pickupIdCounter}`,
    kind,
    x: x + (Math.random() - 0.5) * 1.5,
    z: z + (Math.random() - 0.5) * 1.5,
    active: true,
    ttl: PICKUP_TTL,
    maxTtl: PICKUP_TTL,
    bobPhase: Math.random() * Math.PI * 2,
    attractionRange: ATTRACT_RANGE,
  };
}

// ── Pickup Update ───────────────────────────────────────────────

export function updatePickup(state: PickupState, dt: number): PickupState {
  if (!state.active) return state;

  const newTtl = state.ttl - dt;
  return {
    ...state,
    ttl: newTtl,
    bobPhase: state.bobPhase + dt * 3.0,
    active: newTtl > 0,
  };
}

// ── Magnetic Attraction ────────────────────────────────────────
// Pickups gently drift toward the player when within attraction range.

export function applyPickupAttraction(
  state: PickupState,
  playerX: number,
  playerZ: number,
  dt: number,
): { newX: number; newZ: number } {
  if (!state.active) return { newX: state.x, newZ: state.z };

  const dx = playerX - state.x;
  const dz = playerZ - state.z;
  const dist = Math.hypot(dx, dz);

  if (dist > state.attractionRange || dist < 0.1) {
    return { newX: state.x, newZ: state.z };
  }

  // Pull strength increases as pickup gets closer (quadratic ramp)
  const t = 1 - (dist / state.attractionRange);
  const pullSpeed = t * t * 8;

  return {
    newX: state.x + (dx / dist) * pullSpeed * dt,
    newZ: state.z + (dz / dist) * pullSpeed * dt,
  };
}

// ── Pickup Collection ───────────────────────────────────────────

export function tryCollectPickup(
  state: PickupState,
  playerX: number,
  playerZ: number,
  playerMaxShield: number,
  moduleStates: ModuleRuntimeState[],
): PickupCollectionResult {
  if (!state.active) return { collected: false, kind: null, shieldRestore: 0, repairTarget: null, buffGained: null };

  const dist = Math.hypot(playerX - state.x, playerZ - state.z);
  if (dist > COLLECT_RANGE) return { collected: false, kind: null, shieldRestore: 0, repairTarget: null, buffGained: null };

  const kind = state.kind;

  switch (kind) {
    case 'shield_cell': {
      const restore = playerMaxShield * SHIELD_RESTORE_FRACTION;
      return { collected: true, kind, shieldRestore: restore, repairTarget: null, buffGained: null };
    }

    case 'repair_kit': {
      const target = findRepairTarget(moduleStates, false);
      return { collected: true, kind, shieldRestore: 0, repairTarget: target, buffGained: null };
    }

    case 'power_surge': {
      return {
        collected: true,
        kind,
        shieldRestore: 0,
        repairTarget: null,
        buffGained: { kind: 'power_surge', remaining: 6, duration: 6 },
      };
    }

    case 'rapid_fire': {
      return {
        collected: true,
        kind,
        shieldRestore: 0,
        repairTarget: null,
        buffGained: { kind: 'rapid_fire', remaining: 5, duration: 5 },
      };
    }

    case 'salvage': {
      const target = findRepairTarget(moduleStates, true);
      if (!target) {
        // No destroyed modules — refund as shield cell
        const restore = playerMaxShield * SHIELD_RESTORE_FRACTION;
        return { collected: true, kind: 'shield_cell', shieldRestore: restore, repairTarget: null, buffGained: null };
      }
      return { collected: true, kind, shieldRestore: 0, repairTarget: target, buffGained: null };
    }
  }
}

export function applyRepair(target: ModuleRuntimeState, fraction: number): ModuleRuntimeState {
  if (target.destroyed) {
    const repairedHp = target.maxHp * fraction;
    return { ...target, currentHp: repairedHp, destroyed: false };
  }
  const repairedHp = Math.min(target.maxHp, target.currentHp + target.maxHp * (fraction - target.currentHp / target.maxHp));
  return { ...target, currentHp: repairedHp };
}

// ── Buff Management ─────────────────────────────────────────────

export function updateBuffs(buffs: ActiveBuff[], dt: number): ActiveBuff[] {
  return buffs
    .map((buff) => ({ ...buff, remaining: buff.remaining - dt }))
    .filter((buff) => buff.remaining > 0);
}

export function hasBuff(buffs: ActiveBuff[], kind: ActiveBuff['kind']): boolean {
  return buffs.some((b) => b.kind === kind);
}

export function getDamageMultiplier(buffs: ActiveBuff[]): number {
  return hasBuff(buffs, 'power_surge') ? 1.4 : 1.0;
}

export function getCadenceMultiplier(buffs: ActiveBuff[]): number {
  return hasBuff(buffs, 'rapid_fire') ? 1.5 : 1.0;
}

// ── Internal ────────────────────────────────────────────────────

function findRepairTarget(moduleStates: ModuleRuntimeState[], destroyedOnly: boolean): ModuleRuntimeState | null {
  if (destroyedOnly) {
    const destroyed = moduleStates.filter((m) => m.destroyed);
    if (destroyed.length === 0) return null;
    return destroyed[0];
  }

  // Prefer destroyed, then most-damaged alive
  const destroyed = moduleStates.filter((m) => m.destroyed);
  if (destroyed.length > 0) return destroyed[0];

  const damaged = moduleStates
    .filter((m) => !m.destroyed && m.currentHp < m.maxHp)
    .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp));
  return damaged[0] ?? null;
}

// ── Rendering Helpers (used by FlightScene minimap) ─────────────

export function getPickupColor(kind: PickupKind): string {
  return PICKUP_CONFIG[kind].color;
}

export function getPickupLabel(kind: PickupKind): string {
  return PICKUP_CONFIG[kind].label;
}

export function getPickupIcon(kind: PickupKind): string {
  switch (kind) {
    case 'shield_cell': return '🛡';
    case 'repair_kit': return '🔧';
    case 'power_surge': return '⚡';
    case 'rapid_fire': return '🔥';
    case 'salvage': return '💎';
  }
}
