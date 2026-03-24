// ── Environmental Hazard System ──────────────────────────────────
//
// Interactive arena elements that add tactical depth to combat.
//
// Hazard types:
// - Asteroid: Destructible obstacle that blocks movement and projectiles.
//   Ships are pushed out on collision; projectiles are absorbed and damage
//   the asteroid. Destroying an asteroid creates debris particles.
//
// - Shield Conduit: Recharge zone that restores shield energy for any ship
//   passing through. Has a finite charge that slowly regenerates over time.
//   Depleted conduits dim visually and stop providing shield restoration.
//
// - Damage Nebula: Hazardous area that deals energy damage per second to
//   ships inside and drains shields at 2x the normal rate. Projectiles
//   passing through receive a 15% damage boost (focused energy channeling).
//
// Hazards are configured per-encounter-wave and generated procedurally
// for endless mode. They appear on the minimap with distinct colors.

import type { DamageType } from '../core/types';

export type HazardKind = 'asteroid' | 'shield_conduit' | 'damage_nebula';

export interface HazardSpawn {
  kind: HazardKind;
  x: number;
  z: number;
  radius: number;
  hp?: number;
  damagePerSecond?: number;
}

export interface HazardState {
  id: string;
  kind: HazardKind;
  x: number;
  z: number;
  radius: number;
  active: boolean;
  // Asteroid
  hp: number;
  maxHp: number;
  // Shield conduit
  charge: number;          // 0..1
  rechargeRate: number;    // per second
  shieldRestore: number;   // shield points per second while inside
  // Damage nebula
  damagePerSecond: number;
  damageType: DamageType;
  pulsePhase: number;      // for visual pulsing (radians)
  // Tracking
  lastShipInside: Map<string, number>; // ship id → last interaction timestamp
}

let hazardIdCounter = 0;

export function createHazardState(spawn: HazardSpawn): HazardState {
  const id = `hazard-${++hazardIdCounter}`;
  switch (spawn.kind) {
    case 'asteroid':
      return {
        id, kind: 'asteroid',
        x: spawn.x, z: spawn.z, radius: spawn.radius,
        active: true,
        hp: spawn.hp ?? 80,
        maxHp: spawn.hp ?? 80,
        charge: 0, rechargeRate: 0, shieldRestore: 0,
        damagePerSecond: 0, damageType: 'kinetic', pulsePhase: 0,
        lastShipInside: new Map(),
      };
    case 'shield_conduit':
      return {
        id, kind: 'shield_conduit',
        x: spawn.x, z: spawn.z, radius: spawn.radius,
        active: true,
        hp: 9999, maxHp: 9999,
        charge: 1, rechargeRate: 0.1, shieldRestore: 18,
        damagePerSecond: 0, damageType: 'energy', pulsePhase: 0,
        lastShipInside: new Map(),
      };
    case 'damage_nebula':
      return {
        id, kind: 'damage_nebula',
        x: spawn.x, z: spawn.z, radius: spawn.radius,
        active: true,
        hp: 9999, maxHp: 9999,
        charge: 0, rechargeRate: 0, shieldRestore: 0,
        damagePerSecond: spawn.damagePerSecond ?? 14,
        damageType: 'energy',
        pulsePhase: Math.random() * Math.PI * 2,
        lastShipInside: new Map(),
      };
  }
}

export function createHazardStates(spawns: HazardSpawn[]): HazardState[] {
  return spawns.map(createHazardState);
}

export function updateHazard(state: HazardState, dt: number): HazardState {
  if (!state.active) return state;

  if (state.kind === 'shield_conduit') {
    return { ...state, charge: Math.min(1, state.charge + state.rechargeRate * dt) };
  }

  if (state.kind === 'damage_nebula') {
    return { ...state, pulsePhase: state.pulsePhase + dt * 1.8 };
  }

  return state;
}

export interface ShipHazardResult {
  shieldRestored: number;
  damageTaken: number;
  shieldDrainMultiplier: number; // multiplier applied to shield drain while inside
  pushX: number;
  pushZ: number;
}


export function applyShipHazardCollision(
  hazard: HazardState,
  shipId: string,
  shipX: number,
  shipZ: number,
  shipRadius: number,
  dt: number,
  now: number,
): ShipHazardResult {
  const dx = shipX - hazard.x;
  const dz = shipZ - hazard.z;
  const dist = Math.hypot(dx, dz);
  const overlap = hazard.radius + shipRadius - dist;

  if (overlap <= 0 || !hazard.active) {
    return { shieldRestored: 0, damageTaken: 0, shieldDrainMultiplier: 1, pushX: 0, pushZ: 0 };
  }

  const zero: ShipHazardResult = { shieldRestored: 0, damageTaken: 0, shieldDrainMultiplier: 1, pushX: 0, pushZ: 0 };

  // Asteroid: push ship out, no ongoing damage
  if (hazard.kind === 'asteroid') {
    if (dist < 0.01) {
      return { ...zero, pushX: 0, pushZ: -overlap };
    }
    const nx = dx / dist;
    const nz = dz / dist;
    return { ...zero, pushX: nx * overlap, pushZ: nz * overlap };
  }

  // Shield conduit: continuous shield restoration while inside, draining charge
  if (hazard.kind === 'shield_conduit') {
    if (hazard.charge < 0.05) return zero;

    const restoreAmount = hazard.shieldRestore * dt;
    // Consume charge proportional to restoration
    const chargeConsumed = (restoreAmount / 60) * 0.4; // roughly depletes in ~15s of continuous use
    hazard.charge = Math.max(0, hazard.charge - chargeConsumed);
    hazard.lastShipInside.set(shipId, now);

    return { ...zero, shieldRestored: restoreAmount };
  }

  // Damage nebula: deal damage, amplify shield drain
  if (hazard.kind === 'damage_nebula') {
    const pulse = 0.85 + 0.15 * Math.sin(hazard.pulsePhase);
    const damage = hazard.damagePerSecond * dt * pulse;
    return { ...zero, damageTaken: damage, shieldDrainMultiplier: 2.0 };
  }

  return zero;
}

export function damageAsteroid(hazard: HazardState, damage: number): HazardState {
  if (hazard.kind !== 'asteroid' || !hazard.active) return hazard;
  const newHp = hazard.hp - damage;
  return {
    ...hazard,
    hp: Math.max(0, newHp),
    active: newHp > 0,
  };
}

export function checkProjectileAsteroidCollision(
  projX: number,
  projZ: number,
  hazard: HazardState,
): boolean {
  if (hazard.kind !== 'asteroid' || !hazard.active) return false;
  return Math.hypot(projX - hazard.x, projZ - hazard.z) <= hazard.radius;
}

/**
 * Check if a projectile passes through a damage nebula and should get a damage boost.
 */
export function checkProjectileNebulaBoost(
  projX: number,
  projZ: number,
  hazard: HazardState,
): boolean {
  if (hazard.kind !== 'damage_nebula' || !hazard.active) return false;
  return Math.hypot(projX - hazard.x, projZ - hazard.z) <= hazard.radius;
}

/**
 * Generate random hazard spawns for endless mode waves.
 * More and more dangerous hazards appear as waves progress.
 */
export function generateRandomHazards(waveNumber: number, arenaRadius: number): HazardSpawn[] {
  const hazards: HazardSpawn[] = [];
  const maxHazards = Math.min(1 + Math.floor(waveNumber / 3), 5);

  for (let i = 0; i < maxHazards; i++) {
    const angle = (i / maxHazards) * Math.PI * 2 + seededRandom(waveNumber * 100 + i * 37) * 0.6 - 0.3;
    const dist = 4 + seededRandom(waveNumber * 200 + i * 53) * (arenaRadius - 8);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const roll = seededRandom(waveNumber * 300 + i * 71);
    if (roll < 0.45) {
      const radius = 0.7 + seededRandom(waveNumber * 400 + i * 11) * 0.8;
      hazards.push({ kind: 'asteroid', x, z, radius, hp: 60 + waveNumber * 5 });
    } else if (roll < 0.75) {
      hazards.push({ kind: 'shield_conduit', x, z, radius: 1.3 + seededRandom(waveNumber * 500 + i * 23) * 0.4 });
    } else {
      const dps = 10 + waveNumber * 2;
      hazards.push({ kind: 'damage_nebula', x, z, radius: 2.0 + seededRandom(waveNumber * 600 + i * 41) * 1.2, damagePerSecond: dps });
    }
  }

  return hazards;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/**
 * Compute a steering force for AI to avoid asteroids and optionally seek conduits.
 * Returns a force vector that should be added to the enemy's velocity.
 */
export function computeHazardSteering(
  fromX: number,
  fromZ: number,
  hazards: HazardState[],
  seekConduit: boolean,
  avoidNebula: boolean,
): { x: number; z: number } {
  let steerX = 0;
  let steerZ = 0;

  for (const hazard of hazards) {
    if (!hazard.active) continue;
    const dx = fromX - hazard.x;
    const dz = fromZ - hazard.z;
    const dist = Math.hypot(dx, dz);
    const minDist = hazard.radius + 2.5;

    if (hazard.kind === 'asteroid' && dist < minDist) {
      // Repulsive force from asteroids
      const strength = (minDist - dist) / minDist;
      if (dist > 0.01) {
        steerX += (dx / dist) * strength * 4;
        steerZ += (dz / dist) * strength * 4;
      }
    }

    if (hazard.kind === 'shield_conduit' && seekConduit && hazard.charge > 0.3 && dist > 1) {
      // Attractive force toward charged conduits (for damaged enemies)
      const strength = 0.5 / Math.max(1, dist);
      steerX -= (dx / dist) * strength;
      steerZ -= (dz / dist) * strength;
    }

    if (hazard.kind === 'damage_nebula' && avoidNebula && dist < hazard.radius + 1.5) {
      // Repulsive force from damage nebulas
      const strength = 2 / Math.max(1, dist);
      if (dist > 0.01) {
        steerX += (dx / dist) * strength;
        steerZ += (dz / dist) * strength;
      }
    }
  }

  return { x: steerX, z: steerZ };
}
