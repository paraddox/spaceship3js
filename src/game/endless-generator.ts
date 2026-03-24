import * as THREE from 'three';
import type { ShipBlueprint } from '../core/types';
import type { EncounterEnemy, EncounterWave } from './encounters';
import { generateRandomHazards } from './hazards';
import { DEFAULT_CREW_ALLOCATION } from './crew';
import { rollAffixes } from './elite-affixes';

// ── Procedural Wave Generator ─────────────────────────────────
//
// Generates infinite unique waves of enemies with scaling difficulty.
// Uses the existing module catalog to create varied enemy compositions.
//
// Difficulty scales along multiple axes:
// - Enemy count (1 → 7+)
// - Ship size (scout → frigate)
// - Weapon upgrades (light laser → beam → heavy cannon)
// - Crew specialization
// - Shield and armor presence
// - Fire accuracy (lower jitter = deadlier aim)
//
// Every 5 waves is a "milestone" wave with a frigate-class boss.

// ── Enemy Blueprint Templates ──────────────────────────────────

const scoutBase: ShipBlueprint = {
  name: 'Raider Scout',
  crew: { ...DEFAULT_CREW_ALLOCATION },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'hull', definitionId: 'core:hull_1x1', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'engine', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'weapon', definitionId: 'core:laser_light', position: { q: -1, r: -1 }, rotation: 0 },
  ],
};

const shieldScout: ShipBlueprint = {
  name: 'Shielded Raider',
  crew: { ...DEFAULT_CREW_ALLOCATION, engineer: 1 },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'hull', definitionId: 'core:hull_1x1', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'engine', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'shield', definitionId: 'core:shield_generator', position: { q: -1, r: -1 }, rotation: 0 },
    { instanceId: 'weapon', definitionId: 'core:laser_light', position: { q: 0, r: -1 }, rotation: 0 },
  ],
};

const cannonScout: ShipBlueprint = {
  name: 'Cannon Raider',
  crew: { ...DEFAULT_CREW_ALLOCATION, gunner: 1 },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'reactor2', definitionId: 'core:reactor_small', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'engine', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'weapon', definitionId: 'core:cannon_kinetic', position: { q: 0, r: -1 }, rotation: 0 },
  ],
};

const missileScout: ShipBlueprint = {
  name: 'Missile Raider',
  crew: { ...DEFAULT_CREW_ALLOCATION, tactician: 1 },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'hull', definitionId: 'core:hull_1x1', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'engine', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'engine2', definitionId: 'core:thruster_lateral', position: { q: -2, r: 1 }, rotation: 0 },
    { instanceId: 'weapon', definitionId: 'core:missile_launcher', position: { q: 0, r: -1 }, rotation: 0 },
  ],
};

const beamScout: ShipBlueprint = {
  name: 'Beam Interdictor',
  crew: { ...DEFAULT_CREW_ALLOCATION, engineer: 1, gunner: 1 },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'reactor2', definitionId: 'core:reactor_small', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'engine', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'weapon', definitionId: 'core:laser_beam_light', position: { q: 0, r: -1 }, rotation: 0 },
    { instanceId: 'hull', definitionId: 'core:hull_1x1', position: { q: -1, r: -1 }, rotation: 0 },
  ],
};

const droneScout: ShipBlueprint = {
  name: 'Drone Carrier',
  crew: { ...DEFAULT_CREW_ALLOCATION, tactician: 1, engineer: 1 },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'hull', definitionId: 'core:hull_2x1', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'engine', definitionId: 'core:thruster_small', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'drone', definitionId: 'core:light_drone_bay', position: { q: 0, r: -1 }, rotation: 0 },
    { instanceId: 'weapon', definitionId: 'core:laser_light', position: { q: -2, r: 1 }, rotation: 0 },
  ],
};

const frigateBoss: ShipBlueprint = {
  name: 'Frigate Overlord',
  crew: { ...DEFAULT_CREW_ALLOCATION, gunner: 2, engineer: 1, tactician: 1 },
  modules: [
    { instanceId: 'bridge-f', definitionId: 'core:bridge_frigate', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'reactor-f1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'reactor-f2', definitionId: 'core:reactor_small', position: { q: -1, r: 0 }, rotation: 0 },
    { instanceId: 'hull-f1', definitionId: 'core:hull_2x1', position: { q: 2, r: -1 }, rotation: 0 },
    { instanceId: 'hull-f2', definitionId: 'core:hull_1x1', position: { q: -1, r: -1 }, rotation: 0 },
    { instanceId: 'armor-f1', definitionId: 'core:armor_plating', position: { q: -2, r: 0 }, rotation: 0 },
    { instanceId: 'shield-f1', definitionId: 'core:shield_generator', position: { q: 0, r: -2 }, rotation: 0 },
    { instanceId: 'engine-f1', definitionId: 'core:thruster_small', position: { q: 3, r: -2 }, rotation: 0 },
    { instanceId: 'engine-f2', definitionId: 'core:thruster_lateral', position: { q: -3, r: 1 }, rotation: 0 },
    { instanceId: 'weapon-f1', definitionId: 'core:cannon_heavy', position: { q: 0, r: 1 }, rotation: 0 },
    { instanceId: 'weapon-f2', definitionId: 'core:missile_launcher', position: { q: -1, r: 1 }, rotation: 0 },
    { instanceId: 'drone-f1', definitionId: 'core:light_drone_bay', position: { q: 1, r: -1 }, rotation: 0 },
  ],
};

// ── Blueprint pools by difficulty tier ─────────────────────────

interface DifficultyTier {
  /** Minimum wave number to qualify for this tier */
  minWave: number;
  /** Blueprints that can appear at this tier */
  pool: ShipBlueprint[];
  /** Chance of frigate-class enemy (0–1) */
  frigateChance: number;
  /** Base enemy count */
  baseCount: number;
  /** Maximum enemy count */
  maxCount: number;
  /** Jitter range — lower = more accurate */
  jitterRange: [number, number];
  /** Display label for the wave announcement */
  tierLabel: string;
}

const TIERS: DifficultyTier[] = [
  {
    minWave: 1,
    pool: [scoutBase],
    frigateChance: 0,
    baseCount: 1,
    maxCount: 2,
    jitterRange: [0.3, 0.5],
    tierLabel: 'Patrol',
  },
  {
    minWave: 4,
    pool: [scoutBase, cannonScout],
    frigateChance: 0,
    baseCount: 2,
    maxCount: 3,
    jitterRange: [0.25, 0.45],
    tierLabel: 'Skirmish',
  },
  {
    minWave: 7,
    pool: [scoutBase, cannonScout, beamScout, missileScout],
    frigateChance: 0,
    baseCount: 2,
    maxCount: 4,
    jitterRange: [0.2, 0.4],
    tierLabel: 'Raid',
  },
  {
    minWave: 11,
    pool: [cannonScout, beamScout, missileScout, shieldScout, droneScout],
    frigateChance: 0.08,
    baseCount: 3,
    maxCount: 5,
    jitterRange: [0.18, 0.35],
    tierLabel: 'Siege',
  },
  {
    minWave: 16,
    pool: [cannonScout, beamScout, missileScout, shieldScout, droneScout],
    frigateChance: 0.15,
    baseCount: 3,
    maxCount: 6,
    jitterRange: [0.15, 0.3],
    tierLabel: 'Armada',
  },
  {
    minWave: 22,
    pool: [cannonScout, beamScout, missileScout, shieldScout, droneScout],
    frigateChance: 0.25,
    baseCount: 4,
    maxCount: 7,
    jitterRange: [0.12, 0.25],
    tierLabel: 'Onslaught',
  },
];

// ── Wave generation ────────────────────────────────────────────

function getTier(waveNumber: number): DifficultyTier {
  // Walk backward to find the highest qualifying tier
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (waveNumber >= TIERS[i].minWave) return TIERS[i];
  }
  return TIERS[0];
}

function pickBlueprint(tier: DifficultyTier, waveNumber: number, seed: number): ShipBlueprint {
  // Boss waves: frigate
  if (waveNumber % 5 === 0) return frigateBoss;

  // Random frigate chance at higher tiers
  if (tier.frigateChance > 0 && seededRandom(seed) < tier.frigateChance) {
    return frigateBoss;
  }

  // Pick from pool
  const pool = tier.pool;
  const index = Math.floor(seededRandom(seed + 1) * pool.length);
  return pool[index];
}

function seededRandom(seed: number): number {
  // Simple deterministic hash for reproducible-but-varied waves
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function computeEnemyCount(waveNumber: number, tier: DifficultyTier): number {
  // Boss waves are single scripted encounters. Later difficulty should come
  // from the boss itself getting stronger, not from spawning extra boss-grade
  // ships that the single boss controller cannot drive coherently.
  if (waveNumber % 5 === 0) return 1;

  // Scale count with wave number within tier bounds
  const waveScale = Math.min(1, (waveNumber - tier.minWave) / 12);
  const count = tier.baseCount + Math.round(waveScale * (tier.maxCount - tier.baseCount));
  return Math.min(count, tier.maxCount);
}

function computeSpawnPosition(index: number, total: number, waveNumber: number): { x: number; z: number; rotation: number } {
  // Distribute enemies in an arc around the far side of the arena
  const arcRadius = 9 + Math.min(waveNumber * 0.3, 8);
  if (total <= 1) {
    return { x: 0, z: -arcRadius, rotation: 0 };
  }

  // Spread across a 120-degree arc centered on -Z
  const arcSpan = Math.PI * 0.66;
  const arcStart = -Math.PI / 2 - arcSpan / 2;
  const t = index / (total - 1);
  const angle = arcStart + t * arcSpan;

  return {
    x: Math.sin(angle) * arcRadius,
    z: Math.cos(angle) * arcRadius - 2,
    rotation: 0,
  };
}

/**
 * Generate a unique encounter wave for the given wave number.
 *
 * Wave number is the primary driver of difficulty. The generator
 * uses deterministic seeding so the same wave number always produces
 * the same composition (consistent experience, no weird reloads).
 */
export function generateEndlessWave(waveNumber: number): EncounterWave {
  const tier = getTier(waveNumber);
  const count = computeEnemyCount(waveNumber, tier);
  const seed = waveNumber * 7 + 3;
  const isBoss = waveNumber % 5 === 0;

  const enemies: EncounterEnemy[] = [];
  for (let i = 0; i < count; i++) {
    const blueprint = pickBlueprint(tier, waveNumber, seed + i * 13);
    const pos = computeSpawnPosition(i, count, waveNumber);
    const jitter = tier.jitterRange[0] + seededRandom(seed + i * 29 + 7) * (tier.jitterRange[1] - tier.jitterRange[0]);

    // Boss frigates have tighter preferred range and better aim
    const isFrigate = blueprint === frigateBoss;
    const preferredRange = isFrigate
      ? 8 + seededRandom(seed + i * 41) * 3
      : 7 + seededRandom(seed + i * 41) * 5;
    const fireJitter = isFrigate
      ? Math.max(0.1, jitter * 0.6)
      : jitter;

    enemies.push({
      id: `wave${waveNumber}-enemy-${i}`,
      blueprint,
      position: new THREE.Vector3(pos.x, 0, pos.z),
      rotation: pos.rotation,
      preferredRange,
      fireJitter,
      affixes: waveNumber >= 3 ? rollAffixes(waveNumber, isFrigate, seed + i * 53 + 11) : [],
    });
  }

  // Wave naming
  let waveName: string;
  if (isBoss) {
    waveName = waveNumber <= 5 ? 'Boss: Frigate Spearhead' : `Boss Wave ${waveNumber}`;
  } else {
    waveName = `${tier.tierLabel} ${waveNumber}`;
  }

  return { name: waveName, enemies, hazards: generateRandomHazards(waveNumber, 18) };
}

/**
 * Compute the credits reward for clearing an endless wave.
 * Scales exponentially with wave number.
 */
export function endlessWaveCredits(waveNumber: number): number {
  const base = 20 + waveNumber * 8;
  const bossMultiplier = waveNumber % 5 === 0 ? 2.5 : 1;
  return Math.round(base * bossMultiplier);
}

/**
 * Compute the score for clearing an endless wave.
 */
export function endlessWaveScore(waveNumber: number): number {
  const base = 100 + waveNumber * 40;
  const bossMultiplier = waveNumber % 5 === 0 ? 3 : 1;
  return Math.round(base * bossMultiplier);
}
