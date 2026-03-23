// ── Blueprint Scavenging ─────────────────────────────────────
//
// Defeating elite or boss enemies has a chance to salvage their
// ship design as a permanent blueprint in your collection.
// Salvaged blueprints feed back into the hangar/editor, creating
// a compounding "one more run" discovery loop.
//
// Persistence: localStorage via FlightScene → App.ts
// Scope: endless mode only

import type { ShipBlueprint } from '../core/types';

// ── Types ────────────────────────────────────────────────────

export type SalvageRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SalvageRarityConfig {
  label: string;
  color: string;
  glow: string;
}

export interface SalvagedBlueprint {
  /** Unique ID for this salvage entry. */
  id: string;
  /** The captured blueprint. */
  blueprint: ShipBlueprint;
  /** Rarity tier of this salvage. */
  rarity: SalvageRarity;
  /** Display name for the salvaged ship. */
  name: string;
  /** Wave number when salvaged. */
  waveNumber: number;
  /** Whether the killed enemy was a boss. */
  wasBoss: boolean;
  /** Affix names the enemy had (for flavor). */
  affixNames: string[];
  /** Timestamp of salvage. */
  salvagedAt: number;
  /** Run number when salvaged. */
  runNumber: number;
}

export interface SalvageCollection {
  /** All salvaged blueprints. */
  entries: SalvagedBlueprint[];
  /** Total salvage attempts across all runs. */
  totalAttempts: number;
  /** Total successful salvages. */
  totalSalvaged: number;
}

export interface SalvageRollInput {
  waveNumber: number;
  isElite: boolean;
  isBoss: boolean;
  comboTier: number;
  hasCreditBooster: boolean;
}

export interface SalvageResult {
  entry: SalvagedBlueprint;
  isNew: boolean;
}

// ── Constants ────────────────────────────────────────────────

export const SALVAGE_STORAGE_KEY = 'spachip3js.salvage';

export const RARITY_CONFIG: Record<SalvageRarity, SalvageRarityConfig> = {
  common:   { label: 'Common',   color: '#94a3b8', glow: '#94a3b820' },
  rare:     { label: 'Rare',     color: '#60a5fa', glow: '#60a5fa20' },
  epic:     { label: 'Epic',     color: '#c084fc', glow: '#c084fc20' },
  legendary:{ label: 'Legendary',color: '#fbbf24', glow: '#fbbf2420' },
};

// ── Default State ────────────────────────────────────────────

export const DEFAULT_SALVAGE_COLLECTION: SalvageCollection = {
  entries: [],
  totalAttempts: 0,
  totalSalvaged: 0,
};

// ── Salvage Chance ──────────────────────────────────────────
//
// Base chance scales with wave number.
// Elite kills get 3x multiplier, bosses get 5x.
// Combo tier adds +5% per tier (capped at +15%).
// Credit booster bonus adds +5%.

export function getSalvageChance(input: SalvageRollInput): number {
  // Base: 2% + 0.5% per wave (caps at 15%)
  const baseChance = Math.min(0.15, 0.02 + input.waveNumber * 0.005);

  let multiplier = 1.0;
  if (input.isElite) multiplier *= 3;
  if (input.isBoss) multiplier *= 5;
  if (input.hasCreditBooster) multiplier *= 1.15;

  // Combo bonus: +5% per tier, max +15%
  const comboBonus = Math.min(0.15, input.comboTier * 0.05);

  return Math.min(1.0, baseChance * multiplier + comboBonus);
}

// ── Rarity Determination ────────────────────────────────────
//
// Rarity depends on enemy type and wave number.
// Bosses shift the distribution toward higher rarities.

export function rollSalvageRarity(
  isElite: boolean,
  isBoss: boolean,
  waveNumber: number,
  rng: number, // 0–1
): SalvageRarity {
  // Each rarity has a weight threshold (0–100 scale)
  // Boss/elite waves shift thresholds toward rarer outcomes
  const waveBonus = Math.min(15, Math.floor(waveNumber / 2));
  const eliteBonus = isElite ? 10 : 0;
  const bossBonus = isBoss ? 25 : 0;
  const shift = waveBonus + eliteBonus + bossBonus;

  // Thresholds (before shift): common 60, rare 85, epic 97, legendary 100
  const roll = rng * 100;

  if (roll < 60 - shift) return 'common';
  if (roll < 85 - shift * 0.6) return 'rare';
  if (roll < 97 - shift * 0.3) return 'epic';
  return 'legendary';
}

// ── Name Generation ─────────────────────────────────────────
//
// Generates a flavorful name for the salvaged blueprint.

const SHIP_CLASS_PREFIXES: Record<string, string[]> = {
  'core:bridge_scout': ['Raider', 'Corsair', 'Viper'],
  'core:bridge_frigate': ['Sentinel', 'Warden', 'Paladin'],
  'core:bridge_cruiser': ['Dominator', 'Overlord', 'Juggernaut'],
};

const RARITY_SUFFIXES: Record<SalvageRarity, string[]> = {
  common:    ['Hull', 'Frame', 'Wreck'],
  rare:      ['Relic', 'Remnant', 'Artifact'],
  epic:      ['Prototype', 'Schema', 'Blueprint'],
  legendary: ['Masterwork', 'Paragon', 'Apex'],
};

function generateSalvageName(
  blueprint: ShipBlueprint,
  rarity: SalvageRarity,
  affixNames: string[],
  seed: number,
): string {
  // Find the bridge module to determine ship class
  const bridge = blueprint.modules.find((m) => m.definitionId.includes('bridge'));
  const classPrefixes = bridge
    ? (SHIP_CLASS_PREFIXES[bridge.definitionId] ?? ['Unknown'])
    : ['Unknown'];

  const prefix = classPrefixes[Math.abs(seed) % classPrefixes.length];
  const suffixes = RARITY_SUFFIXES[rarity];
  const suffix = suffixes[Math.abs(seed * 7 + 3) % suffixes.length];

  const affixPart = affixNames.length > 0
    ? ` ${affixNames[Math.abs(seed * 13) % affixNames.length]}`
    : '';

  return `${prefix}${affixPart} ${suffix}`;
}

// ── Core Salvage Roll ───────────────────────────────────────
//
// The main function: roll for salvage on enemy kill.
// Returns null on failure, or a SalvageResult on success.

export function rollSalvage(
  input: SalvageRollInput,
  blueprint: ShipBlueprint,
  affixNames: string[],
  collection: SalvageCollection,
  runNumber: number,
  rng: number, // 0–1
): SalvageResult | null {
  const chance = getSalvageChance(input);
  if (rng > chance) return null;

  const rarity = rollSalvageRarity(input.isElite, input.isBoss, input.waveNumber, rng);
  const id = crypto.randomUUID();
  const name = generateSalvageName(blueprint, rarity, affixNames, Math.floor(rng * 100000));

  const entry: SalvagedBlueprint = {
    id,
    blueprint: structuredClone(blueprint),
    rarity,
    name,
    waveNumber: input.waveNumber,
    wasBoss: input.isBoss,
    affixNames,
    salvagedAt: Date.now(),
    runNumber,
  };

  const isNew = !collection.entries.some((e) => {
    // Consider duplicate if same name and same module count + composition
    if (e.name !== name) return false;
    if (e.blueprint.modules.length !== entry.blueprint.modules.length) return false;
    return e.blueprint.modules.every((m, i) =>
      m.definitionId === entry.blueprint.modules[i].definitionId &&
      m.position.q === entry.blueprint.modules[i].position.q &&
      m.position.r === entry.blueprint.modules[i].position.r,
    );
  });

  return { entry, isNew };
}

// ── Collection Management ───────────────────────────────────

export function addSalvageEntry(collection: SalvageCollection, entry: SalvagedBlueprint): SalvageCollection {
  return {
    ...collection,
    entries: [entry, ...collection.entries],
    totalSalvaged: collection.totalSalvaged + 1,
  };
}

export function recordSalvageAttempt(collection: SalvageCollection): SalvageCollection {
  return {
    ...collection,
    totalAttempts: collection.totalAttempts + 1,
  };
}

/** Check if a blueprint with the same composition already exists. */
export function hasDuplicateBlueprint(collection: SalvageCollection, entry: SalvagedBlueprint): boolean {
  return collection.entries.some((e) => {
    if (e.blueprint.modules.length !== entry.blueprint.modules.length) return false;
    return e.blueprint.modules.every((m, i) =>
      m.definitionId === entry.blueprint.modules[i].definitionId &&
      m.position.q === entry.blueprint.modules[i].position.q &&
      m.position.r === entry.blueprint.modules[i].position.r,
    );
  });
}

export function getCollectionStats(collection: SalvageCollection): {
  total: number;
  byRarity: Record<SalvageRarity, number>;
  bossCount: number;
  uniqueNames: number;
} {
  const byRarity: Record<SalvageRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  let bossCount = 0;
  const uniqueNames = new Set<string>();

  for (const entry of collection.entries) {
    byRarity[entry.rarity]++;
    if (entry.wasBoss) bossCount++;
    uniqueNames.add(entry.name);
  }

  return { total: collection.entries.length, byRarity, bossCount, uniqueNames: uniqueNames.size };
}

// ── Persistence ──────────────────────────────────────────────

export function loadSalvageCollection(): SalvageCollection {
  try {
    const saved = window.localStorage.getItem(SALVAGE_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_SALVAGE_COLLECTION };
    const data = JSON.parse(saved) as Partial<SalvageCollection>;
    return {
      entries: Array.isArray(data.entries) ? data.entries : [],
      totalAttempts: Number(data.totalAttempts ?? 0),
      totalSalvaged: Number(data.totalSalvaged ?? 0),
    };
  } catch {
    return { ...DEFAULT_SALVAGE_COLLECTION };
  }
}

export function persistSalvageCollection(collection: SalvageCollection): void {
  window.localStorage.setItem(SALVAGE_STORAGE_KEY, JSON.stringify(collection));
}
