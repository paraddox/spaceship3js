// ── Elite Enemy Affix System ──────────────────────────────────
//
// Random modifiers rolled onto enemies in endless mode.
// Starting from wave 3, enemies have a chance to spawn with
// one or more affixes that modify their stats and behavior.
//
// Affixes create variety without adding new ship types.
// Each affix has a visual indicator (color, icon) and
// stat modifications that change how the enemy fights.
//
// Elite enemies (2+ affixes) are visually distinct with
// a glowing aura and grant bonus credits on death.
//
// Affix pool grows with wave number — later waves introduce
// more dangerous affixes.

export interface AffixDef {
  id: string;
  displayName: string;
  icon: string;
  color: string;             // aura color
  description: string;
  minWave: number;           // minimum wave to appear
  weight: number;            // relative rarity (higher = more common)
  // Stat modifications (multipliers, additive bonuses)
  hpMultiplier: number;
  damageMultiplier: number;
  fireRateMultiplier: number;
  speedMultiplier: number;
  shieldMultiplier: number;
  armorBonus: number;
  // Special behavior flags
  regeneratesHp: boolean;    // heals over time
  explodesOnDeath: boolean;  // deals damage in area on death
  swarms: boolean;           // splits into smaller enemies on death
}

export interface RolledAffix {
  def: AffixDef;
}

// ── Affix Catalog ──────────────────────────────────────────────

export const AFFIX_CATALOG: AffixDef[] = [
  {
    id: 'tough',
    displayName: 'Tough',
    icon: '🛡️',
    color: '#38bdf8',
    description: '+50% hull HP',
    minWave: 3,
    weight: 10,
    hpMultiplier: 1.5,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    speedMultiplier: 1,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'aggressive',
    displayName: 'Aggressive',
    icon: '🔥',
    color: '#f97316',
    description: '+30% damage, +25% fire rate',
    minWave: 3,
    weight: 10,
    hpMultiplier: 1,
    damageMultiplier: 1.3,
    fireRateMultiplier: 1.25,
    speedMultiplier: 1,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'swift',
    displayName: 'Swift',
    icon: '💨',
    color: '#a78bfa',
    description: '+40% speed, -10% HP',
    minWave: 4,
    weight: 8,
    hpMultiplier: 0.9,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    speedMultiplier: 1.4,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'shielded',
    displayName: 'Shielded',
    icon: '🔰',
    color: '#22d3ee',
    description: '+100% shield strength, +15% armor',
    minWave: 5,
    weight: 7,
    hpMultiplier: 1,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    speedMultiplier: 1,
    shieldMultiplier: 2,
    armorBonus: 15,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'veteran',
    displayName: 'Veteran',
    icon: '⭐',
    color: '#fbbf24',
    description: '+40% HP, +20% damage, better aim',
    minWave: 6,
    weight: 6,
    hpMultiplier: 1.4,
    damageMultiplier: 1.2,
    fireRateMultiplier: 1,
    speedMultiplier: 1,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'regenerating',
    displayName: 'Regenerating',
    icon: '💚',
    color: '#4ade80',
    description: 'Slowly regenerates hull HP',
    minWave: 7,
    weight: 5,
    hpMultiplier: 1.1,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    speedMultiplier: 1,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: true,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'explosive',
    displayName: 'Explosive',
    icon: '💥',
    color: '#ef4444',
    description: 'Explodes on death, +15% damage',
    minWave: 9,
    weight: 5,
    hpMultiplier: 1,
    damageMultiplier: 1.15,
    fireRateMultiplier: 1,
    speedMultiplier: 1,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: false,
    explodesOnDeath: true,
    swarms: false,
  },
  {
    id: 'gunner',
    displayName: 'Gunner',
    icon: '🎯',
    color: '#fb923c',
    description: '+50% fire rate, +15% damage',
    minWave: 10,
    weight: 5,
    hpMultiplier: 1,
    damageMultiplier: 1.15,
    fireRateMultiplier: 1.5,
    speedMultiplier: 0.95,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'juggernaut',
    displayName: 'Juggernaut',
    icon: '💀',
    color: '#dc2626',
    description: '+80% HP, +25% armor, -20% speed',
    minWave: 12,
    weight: 4,
    hpMultiplier: 1.8,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    speedMultiplier: 0.8,
    shieldMultiplier: 1,
    armorBonus: 25,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
  {
    id: 'overcharged',
    displayName: 'Overcharged',
    icon: '⚡',
    color: '#facc15',
    description: '+35% damage, +40% fire rate, -15% HP',
    minWave: 15,
    weight: 3,
    hpMultiplier: 0.85,
    damageMultiplier: 1.35,
    fireRateMultiplier: 1.4,
    speedMultiplier: 1,
    shieldMultiplier: 1,
    armorBonus: 0,
    regeneratesHp: false,
    explodesOnDeath: false,
    swarms: false,
  },
];

// ── Rolling Logic ──────────────────────────────────────────────

/** Base chance for any affix to appear on a single enemy. */
const BASE_AFFIX_CHANCE = 0.2;

/** Chance scales up with wave number (capped). */
const MAX_AFFIX_CHANCE = 0.65;

/** Chance for a second affix (making it "elite"). Only if first affix rolled. */
const ELITE_SECOND_AFFIX_CHANCE = 0.3;

/** Boss waves always get at least one affix. */
const BOSS_AFFIX_CHANCE = 1.0;

/**
 * Compute the affix roll chance for a given wave number.
 */
export function affixChance(waveNumber: number, isBoss: boolean): number {
  if (isBoss) return BOSS_AFFIX_CHANCE;
  return Math.min(MAX_AFFIX_CHANCE, BASE_AFFIX_CHANCE + waveNumber * 0.02);
}

/**
 * Get affixes available at a given wave number.
 */
export function getAvailableAffixes(waveNumber: number): AffixDef[] {
  return AFFIX_CATALOG.filter((a) => a.minWave <= waveNumber);
}

/**
 * Roll affixes for a single enemy.
 * Uses a deterministic seed for reproducibility.
 *
 * Returns an array of 0-2 rolled affixes.
 */
export function rollAffixes(waveNumber: number, isBoss: boolean, seed: number): RolledAffix[] {
  const chance = affixChance(waveNumber, isBoss);
  const roll1 = seededRandom(seed);

  if (roll1 > chance) return [];

  const pool = getAvailableAffixes(waveNumber);
  if (pool.length === 0) return [];

  const first = weightedPick(pool, seed + 1);
  const result: RolledAffix[] = [{ def: first }];

  // Chance for second affix (elite)
  const roll2 = seededRandom(seed + 2);
  if (roll2 < ELITE_SECOND_AFFIX_CHANCE && pool.length > 1) {
    const remaining = pool.filter((a) => a.id !== first.id);
    if (remaining.length > 0) {
      result.push({ def: weightedPick(remaining, seed + 3) });
    }
  }

  return result;
}

/**
 * Compute the combined stat multiplier from a set of affixes.
 */
export function computeAffixStats(affixes: RolledAffix[]): {
  hpMultiplier: number;
  damageMultiplier: number;
  fireRateMultiplier: number;
  speedMultiplier: number;
  shieldMultiplier: number;
  armorBonus: number;
  regeneratesHp: boolean;
  explodesOnDeath: boolean;
  swarms: boolean;
} {
  let hpMult = 1;
  let dmgMult = 1;
  let frMult = 1;
  let spdMult = 1;
  let shMult = 1;
  let armBonus = 0;
  let regen = false;
  let explode = false;
  let swarm = false;

  for (const { def } of affixes) {
    hpMult *= def.hpMultiplier;
    dmgMult *= def.damageMultiplier;
    frMult *= def.fireRateMultiplier;
    spdMult *= def.speedMultiplier;
    shMult *= def.shieldMultiplier;
    armBonus += def.armorBonus;
    if (def.regeneratesHp) regen = true;
    if (def.explodesOnDeath) explode = true;
    if (def.swarms) swarm = true;
  }

  return {
    hpMultiplier: hpMult,
    damageMultiplier: dmgMult,
    fireRateMultiplier: frMult,
    speedMultiplier: spdMult,
    shieldMultiplier: shMult,
    armorBonus: armBonus,
    regeneratesHp: regen,
    explodesOnDeath: explode,
    swarms: swarm,
  };
}

/**
 * Compute bonus credits for killing an elite enemy.
 * Each affix adds 50% bonus credits.
 */
export function eliteCreditsMultiplier(affixes: RolledAffix[]): number {
  if (affixes.length === 0) return 1;
  return 1 + affixes.length * 0.5;
}

/**
 * Get display label for affixes (e.g., "🛡️ Tough ⚡ Overcharged").
 */
export function affixDisplayLabel(affixes: RolledAffix[]): string {
  if (affixes.length === 0) return '';
  return affixes.map((a) => `${a.def.icon} ${a.def.displayName}`).join(' ');
}

/**
 * Check if the affix set qualifies as "elite" (2+ affixes).
 */
export function isElite(affixes: RolledAffix[]): boolean {
  return affixes.length >= 2;
}

/**
 * Get the primary aura color for an affix set.
 * For multiple affixes, uses the last (most dangerous) affix's color.
 */
export function getAffixColor(affixes: RolledAffix[]): string {
  if (affixes.length === 0) return '';
  return affixes[affixes.length - 1].def.color;
}

// ── Internal ───────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function weightedPick(pool: AffixDef[], seed: number): AffixDef {
  const totalWeight = pool.reduce((sum, a) => sum + a.weight, 0);
  let roll = seededRandom(seed) * totalWeight;
  for (const affix of pool) {
    roll -= affix.weight;
    if (roll <= 0) return affix;
  }
  return pool[pool.length - 1];
}
