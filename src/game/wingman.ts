// ── Wingman System ───────────────────────────────────────────
//
// Deploy a salvaged blueprint as an AI companion wingman.
// Wingmen follow the player, attack enemies autonomously,
// and respawn between waves. They compound with the combo
// system (kills count), overdrive (affected by time dilation),
// and music director (their combat adds intensity).
//
// Persistence: selected wingman blueprint ID stored in salvage collection.

import type { ShipBlueprint, ShipStats } from '../core/types';

// ── Types ────────────────────────────────────────────────────

export interface WingmanConfig {
  /** Blueprint ID from the salvage collection to deploy. */
  blueprintId: string;
  /** Display name. */
  name: string;
  /** Rarity color for HUD/minimap. */
  color: string;
}

export interface WingmanState {
  /** Whether the wingman is currently active (alive and deployed). */
  active: boolean;
  /** Config for the current wingman. */
  config: WingmanConfig | null;
  /** Cooldown before respawn (seconds). 0 = alive. */
  respawnTimer: number;
  /** Total kills contributed this run. */
  totalKills: number;
  /** Total damage dealt this run. */
  totalDamageDealt: number;
  /** Seconds since last firing (for cadence control). */
  fireTimer: number;
  /** Current HP fraction (0–1). Updated each frame from RuntimeShip. */
  hpFraction: number;
  /** AI target — ID of the enemy ship currently targeted. */
  targetId: string | null;
}

// ── Constants ────────────────────────────────────────────────

/** Respawn delay after wingman death (seconds). */
export const WINGMAN_RESPAWN_DELAY = 5;

/** Wingman follow distance from player. */
export const WINGMAN_FOLLOW_DISTANCE = 6;

/** Wingman attack range — will shoot enemies within this distance. */
export const WINGMAN_ATTACK_RANGE = 18;

/** Wingman fire rate multiplier (slower than player to avoid dominance). */
export const WINGMAN_FIRE_RATE_MULT = 0.7;

/** Wingman damage multiplier (slightly weaker than player). */
export const WINGMAN_DAMAGE_MULT = 0.6;

/** Minimum distance to maintain from the target enemy. */
export const WINGMAN_MIN_RANGE = 4;

// ── State Management ────────────────────────────────────────

export function createWingmanState(): WingmanState {
  return {
    active: false,
    config: null,
    respawnTimer: 0,
    totalKills: 0,
    totalDamageDealt: 0,
    fireTimer: 0,
    hpFraction: 1,
    targetId: null,
  };
}

export function deployWingman(state: WingmanState, config: WingmanConfig): WingmanState {
  return {
    ...state,
    active: true,
    config,
    respawnTimer: 0,
    fireTimer: 0,
    hpFraction: 1,
    targetId: null,
  };
}

export function killWingman(state: WingmanState): WingmanState {
  return {
    ...state,
    active: false,
    respawnTimer: WINGMAN_RESPAWN_DELAY,
  };
}

export function updateWingmanTimers(state: WingmanState, dt: number): WingmanState {
  if (state.active) return state;
  if (state.respawnTimer <= 0) return state;
  const newTimer = Math.max(0, state.respawnTimer - dt);
  // Auto-respawn
  if (newTimer <= 0 && state.config) {
    return {
      ...state,
      active: true,
      respawnTimer: 0,
      fireTimer: 0,
      hpFraction: 1,
      targetId: null,
    };
  }
  return { ...state, respawnTimer: newTimer };
}

// ── AI Behavior ─────────────────────────────────────────────

export interface WingmanAIInput {
  playerX: number;
  playerZ: number;
  playerRotation: number;
  wingmanX: number;
  wingmanZ: number;
  wingmanRotation: number;
  enemyPositions: Array<{ id: string; x: number; z: number; alive: boolean }>;
  wingmanFireInterval: number; // seconds between shots
}

export interface WingmanAIOutput {
  /** Target X position to move toward. */
  moveX: number;
  /** Target Z position to move toward. */
  moveZ: number;
  /** Target rotation (radians). */
  targetRotation: number;
  /** Whether to fire this frame. */
  shouldFire: boolean;
  /** ID of the enemy to target. */
  targetId: string | null;
}

/**
 * Simple wingman AI:
 * 1. If no enemies, follow player at WINGMAN_FOLLOW_DISTANCE offset
 * 2. If enemies exist, move to attack nearest within WINGMAN_ATTACK_RANGE
 * 3. Fire at target if in range and fire timer allows
 */
export function computeWingmanAI(input: WingmanAIInput): WingmanAIOutput {
  const aliveEnemies = input.enemyPositions.filter((e) => e.alive);

  // Find nearest enemy
  let nearestEnemy: { id: string; x: number; z: number } | null = null;
  let nearestDist = Infinity;
  for (const enemy of aliveEnemies) {
    const dx = enemy.x - input.wingmanX;
    const dz = enemy.z - input.wingmanZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }

  // Follow offset position (flank the player's facing direction)
  const offsetX = Math.sin(input.playerRotation + Math.PI * 0.4) * WINGMAN_FOLLOW_DISTANCE;
  const offsetZ = Math.cos(input.playerRotation + Math.PI * 0.4) * WINGMAN_FOLLOW_DISTANCE;
  const followX = input.playerX + offsetX;
  const followZ = input.playerZ + offsetZ;

  if (!nearestEnemy || nearestDist > WINGMAN_ATTACK_RANGE) {
    // No target in range — follow player
    return {
      moveX: followX,
      moveZ: followZ,
      targetRotation: Math.atan2(followX - input.wingmanX, followZ - input.wingmanZ),
      shouldFire: false,
      targetId: null,
    };
  }

  // Target is in attack range — approach but don't get too close
  const dx = nearestEnemy.x - input.wingmanX;
  const dz = nearestEnemy.z - input.wingmanZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  let moveX = nearestEnemy.x;
  let moveZ = nearestEnemy.z;

  // If too close, back up toward player side
  if (dist < WINGMAN_MIN_RANGE) {
    const awayX = input.wingmanX - nearestEnemy.x;
    const awayZ = input.wingmanZ - nearestEnemy.z;
    const awayLen = Math.sqrt(awayX * awayX + awayZ * awayZ) || 1;
    moveX = input.wingmanX + (awayX / awayLen) * WINGMAN_MIN_RANGE;
    moveZ = input.wingmanZ + (awayZ / awayLen) * WINGMAN_MIN_RANGE;
  }

  // Fire if we have a clear shot and timer is ready
  const shouldFire = dist < WINGMAN_ATTACK_RANGE && dist > 1;

  return {
    moveX,
    moveZ,
    targetRotation: Math.atan2(dx, dz),
    shouldFire,
    targetId: nearestEnemy.id,
  };
}

// ── Config Selection ─────────────────────────────────────────

const WINGMAN_STORAGE_KEY = 'spachip3js.wingmanConfig';

export function loadWingmanConfig(): WingmanConfig | null {
  try {
    const saved = window.localStorage.getItem(WINGMAN_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as WingmanConfig;
  } catch {
    return null;
  }
}

export function persistWingmanConfig(config: WingmanConfig | null): void {
  if (config) {
    window.localStorage.setItem(WINGMAN_STORAGE_KEY, JSON.stringify(config));
  } else {
    window.localStorage.removeItem(WINGMAN_STORAGE_KEY);
  }
}
