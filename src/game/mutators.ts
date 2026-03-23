// ── Mutator Trait System ──────────────────────────────────────
//
// Mutators are gameplay-altering traits that change *how* your ship
// plays, not just its stat numbers. Each mutator is a simple rule
// that creates emergent build identity.
//
// Unlike upgrades (flat stat bonuses), mutators fundamentally shift
// playstyle: Vampiric turns kills into healing, Glass Cannon forces
// aggressive positioning, Momentum rewards speed, etc.
//
// Offered in the upgrade shop alongside normal upgrades.
// Player can have at most MAX_MUTATORS active simultaneously.
// Mutators cannot be removed once taken (irrevocable commitment).

import type { LiveUpgradeStats } from './upgrade-shop';

// ── Types ─────────────────────────────────────────────────────

export type MutatorId =
  | 'vampiric'
  | 'glass_cannon'
  | 'momentum'
  | 'thorns'
  | 'last_stand'
  | 'bounty_hunter'
  | 'orbit_shield'
  | 'chain_reaction';

export interface MutatorDef {
  id: MutatorId;
  displayName: string;
  icon: string;
  description: string;
  flavor: string;
  /** Stat modifications applied immediately on pick. */
  statMod?: (stats: LiveUpgradeStats) => LiveUpgradeStats;
  /** Minimum wave to appear in shop. */
  waveMin: number;
  /** Tags for exclusion rules — mutators with same tag can't stack. */
  conflictsWith?: MutatorId[];
}

export interface ActiveMutator {
  def: MutatorDef;
  /** Wave number when acquired (for display). */
  acquiredWave: number;
}

export const MAX_MUTATORS = 3;

// ── Catalog ───────────────────────────────────────────────────

export const MUTATOR_CATALOG: MutatorDef[] = [
  {
    id: 'vampiric',
    displayName: 'Vampiric',
    icon: '🧛',
    description: 'Kills restore 8% max HP',
    flavor: 'The void feeds you.',
    waveMin: 2,
  },
  {
    id: 'glass_cannon',
    displayName: 'Glass Cannon',
    icon: '💎',
    description: '+50% damage, −30% max HP',
    flavor: 'One shot, one kill.',
    statMod: (s) => ({
      ...s,
      damageMultiplier: s.damageMultiplier * 1.5,
      maxHpBonus: s.maxHpBonus - 30,
    }),
    waveMin: 3,
    conflictsWith: ['last_stand'],
  },
  {
    id: 'momentum',
    displayName: 'Momentum',
    icon: '💨',
    description: 'Damage scales up to +40% with speed',
    flavor: 'A ship in motion stays in motion.',
    waveMin: 3,
  },
  {
    id: 'thorns',
    displayName: 'Thorns',
    icon: '🌹',
    description: 'Reflected 20% of damage taken back to attackers',
    flavor: 'Touch me and bleed.',
    waveMin: 4,
    conflictsWith: ['vampiric'],
  },
  {
    id: 'last_stand',
    displayName: 'Last Stand',
    icon: '☠️',
    description: 'Below 25% HP: +100% fire rate, +30% damage',
    flavor: 'Not dead yet.',
    waveMin: 5,
    conflictsWith: ['glass_cannon'],
  },
  {
    id: 'bounty_hunter',
    displayName: 'Bounty Hunter',
    icon: '🎯',
    description: 'Elite kills instantly refresh all ability cooldowns',
    flavor: 'The bigger they are...',
    waveMin: 6,
  },
  {
    id: 'orbit_shield',
    displayName: 'Orbit Shield',
    icon: '🌀',
    description: 'Drones orbit 40% closer and block 1 projectile each every 3s',
    flavor: 'The best defense orbits around you.',
    waveMin: 7,
  },
  {
    id: 'chain_reaction',
    displayName: 'Chain Reaction',
    icon: '🔗',
    description: 'Explosive-affix enemies chain their explosion to other enemies in range',
    flavor: 'Boom goes the dynamite.',
    waveMin: 9,
  },
];

// ── Query Helpers ─────────────────────────────────────────────

/** Check if a mutator is active by id. */
export function hasMutator(active: ActiveMutator[], id: MutatorId): boolean {
  return active.some((m) => m.def.id === id);
}

/** Get all active mutator ids. */
export function getActiveMutatorIds(active: ActiveMutator[]): MutatorId[] {
  return active.map((m) => m.def.id);
}

/**
 * Check if a mutator can be added given the current active set.
 * Returns false if at max capacity or conflicts with an active mutator.
 */
export function canAddMutator(active: ActiveMutator[], candidate: MutatorDef): boolean {
  if (active.length >= MAX_MUTATORS) return false;
  if (active.some((m) => m.def.id === candidate.id)) return false;
  if (candidate.conflictsWith?.some((conflictId) => hasMutator(active, conflictId))) return false;
  return true;
}

/**
 * Get mutators available in the shop for a given wave number.
 * Excludes already-acquired and conflicting mutators.
 */
export function getShopMutators(
  waveNumber: number,
  active: ActiveMutator[],
): MutatorDef[] {
  return MUTATOR_CATALOG.filter((def) => {
    if (def.waveMin > waveNumber) return false;
    if (!canAddMutator(active, def)) return false;
    return true;
  });
}

/**
 * Apply stat modifications from all active mutators.
 * Call this when computing final player stats.
 */
export function applyMutatorStatMods(stats: LiveUpgradeStats, active: ActiveMutator[]): LiveUpgradeStats {
  let result = { ...stats };
  for (const mut of active) {
    if (mut.def.statMod) {
      result = mut.def.statMod(result);
    }
  }
  return result;
}

// ── Runtime Effect Computations ───────────────────────────────

/**
 * Compute momentum damage multiplier based on current speed.
 * Momentum grants up to +40% damage at max speed.
 * Speed threshold: ~6 units/sec for max bonus.
 */
export function momentumDamageMult(active: ActiveMutator[], speed: number): number {
  if (!hasMutator(active, 'momentum')) return 1;
  const MAX_SPEED = 6;
  const bonus = Math.min(speed / MAX_SPEED, 1) * 0.4;
  return 1 + bonus;
}

/**
 * Compute vampiric heal amount from a kill.
 * Returns HP to heal (0 if mutator not active).
 */
export function vampiricHeal(active: ActiveMutator[], maxHp: number): number {
  if (!hasMutator(active, 'vampiric')) return 0;
  return Math.round(maxHp * 0.08);
}

/**
 * Compute thorns damage reflection.
 * Returns fraction of incoming damage to reflect (0 if not active).
 */
export function thornsReflectFraction(active: ActiveMutator[]): number {
  if (!hasMutator(active, 'thorns')) return 0;
  return 0.2;
}

/**
 * Compute Last Stand damage and fire rate bonuses.
 * Returns { damageMult, fireRateMult } — both 1.0 if not active or not low HP.
 */
export function lastStandBonuses(active: ActiveMutator[], hpRatio: number): {
  damageMult: number;
  fireRateMult: number;
} {
  if (!hasMutator(active, 'last_stand') || hpRatio >= 0.25) {
    return { damageMult: 1, fireRateMult: 1 };
  }
  return { damageMult: 1.3, fireRateMult: 2.0 };
}

/**
 * Check if Bounty Hunter is active (for ability refresh on elite kill).
 */
export function bountyHunterActive(active: ActiveMutator[]): boolean {
  return hasMutator(active, 'bounty_hunter');
}

/**
 * Check if Chain Reaction is active (for explosive-affix chain detonation).
 */
export function chainReactionActive(active: ActiveMutator[]): boolean {
  return hasMutator(active, 'chain_reaction');
}

/**
 * Check if Orbit Shield is active (for drone behavior modification).
 */
export function orbitShieldActive(active: ActiveMutator[]): boolean {
  return hasMutator(active, 'orbit_shield');
}
