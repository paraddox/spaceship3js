// ── Ship Lineage — Corrupted Module Extraction ───────────────
//
// When you salvage an elite or boss enemy, the enemy's modules carry
// traces of the affixes that made them dangerous. These traces can be
// extracted into CORRUPTED MODULES — modified versions of catalog
// modules with enemy affix properties baked in.
//
// Corrupted modules are placeable in the editor alongside normal modules.
// They use the same hex footprint and category rules, but carry bonus
// stats and a trade-off cost that reflects their origin.
//
// This transforms salvage from a passive collection into an active
// build-crafting system. Your ship physically accumulates the
// spoils of your career.
//
// Persistence: localStorage
// Scope: endless mode (salvage trigger)

import type { ModuleCategory, ModuleDefinition } from '../core/types';

// ── Types ────────────────────────────────────────────────────

export interface CorruptedModule {
  /** Unique ID. */
  id: string;
  /** The base catalog module this was derived from. */
  baseModuleId: string;
  /** Display name incorporating the affix that created it. */
  displayName: string;
  /** Category (same as base module). */
  category: ModuleCategory;
  /** Hex footprint (same as base module). */
  footprint: { q: number; r: number }[];
  /** Modified module definition with affix bonuses baked in. */
  definition: ModuleDefinition;
  /** Source affix name for flavor. */
  sourceAffix: string;
  /** Source affix color. */
  sourceColor: string;
  /** Whether this came from a boss kill. */
  wasBoss: boolean;
  /** Wave number when extracted. */
  waveNumber: number;
  /** Timestamp of extraction. */
  extractedAt: number;
}

export interface LineageLocker {
  /** All extracted corrupted modules. */
  modules: CorruptedModule[];
}

// ── Affix → Module Property Mapping ─────────────────────────
//
// Each enemy affix translates into stat modifications when extracted
// onto a player module. The mapping is contextual to module category.

interface AffixExtraction {
  /** Stat overrides applied to the base module definition. */
  statOverrides: Partial<ModuleDefinition>;
  /** Description of the corruption effect. */
  flavor: string;
}

function extractAffixProperties(
  affixId: string,
  baseModule: ModuleDefinition,
): AffixExtraction {
  const overrides: Partial<ModuleDefinition> = {};
  let flavor = '';

  switch (affixId) {
    case 'tough': {
      overrides.maxHp = Math.round(baseModule.maxHp * 1.35);
      overrides.mass = Math.round(baseModule.mass * 1.15 * 10) / 10;
      overrides.color = '#38bdf8';
      flavor = 'Reinforced plating absorbs enemy fire';
      break;
    }
    case 'aggressive': {
      const stats = { ...baseModule.stats };
      if ('damage' in stats) stats.damage = Math.round((stats.damage as number) * 1.25);
      if ('damagePerSecond' in stats) stats.damagePerSecond = Math.round((stats.damagePerSecond as number) * 1.25);
      if ('fireRate' in stats) stats.fireRate = Math.round((stats.fireRate as number) * 1.15 * 100) / 100;
      overrides.stats = stats;
      overrides.heatCapacity = Math.round(baseModule.heatCapacity * 0.85);
      overrides.color = '#f97316';
      flavor = 'Overcharged weapons deal more damage but run hotter';
      break;
    }
    case 'swift': {
      const stats = { ...baseModule.stats };
      if ('thrust' in stats) stats.thrust = Math.round((stats.thrust as number) * 1.3);
      if ('efficiency' in stats) stats.efficiency = Math.round(((stats.efficiency as number) + 0.08) * 100) / 100;
      overrides.stats = stats;
      overrides.maxHp = Math.round(baseModule.maxHp * 0.9);
      overrides.color = '#a78bfa';
      flavor = 'Stripped-down engines for maximum speed';
      break;
    }
    case 'shielded': {
      const stats = { ...baseModule.stats };
      if ('shieldStrength' in stats) {
        stats.shieldStrength = Math.round((stats.shieldStrength as number) * 1.5);
      } else {
        stats.shieldStrength = 30;
        stats.shieldRecharge = 3;
      }
      overrides.stats = stats;
      overrides.powerConsumption = (baseModule.powerConsumption ?? 0) + 4;
      overrides.color = '#22d3ee';
      flavor = 'Integrated shield emitter siphons extra power';
      break;
    }
    case 'regenerating': {
      overrides.maxHp = Math.round(baseModule.maxHp * 1.1);
      overrides.heatDissipation = (baseModule.heatDissipation ?? 0) + 0.04;
      const stats = { ...baseModule.stats };
      stats.hpRegen = 2;
      overrides.stats = stats;
      overrides.color = '#4ade80';
      flavor = 'Nanite lattices slowly repair nearby hull';
      break;
    }
    case 'explosive': {
      const stats = { ...baseModule.stats };
      stats.explosionDamage = Math.round((stats.explosionDamage as number ?? 0) * 2.5 + 40);
      stats.explosionRadius = Math.round((stats.explosionRadius as number ?? 1) + 1);
      overrides.stats = stats;
      overrides.maxHp = Math.round(baseModule.maxHp * 0.85);
      overrides.color = '#ef4444';
      flavor = 'Unstable core detonates violently when destroyed';
      break;
    }
    case 'gunner': {
      const stats = { ...baseModule.stats };
      if ('fireRate' in stats) stats.fireRate = Math.round((stats.fireRate as number) * 1.35 * 100) / 100;
      if ('damage' in stats) stats.damage = Math.round((stats.damage as number) * 1.12);
      overrides.stats = stats;
      overrides.powerConsumption = (baseModule.powerConsumption ?? 0) + 3;
      overrides.color = '#fb923c';
      flavor = 'Targeting subroutines increase fire rate and accuracy';
      break;
    }
    case 'veteran': {
      overrides.maxHp = Math.round(baseModule.maxHp * 1.25);
      const stats2 = { ...baseModule.stats };
      if ('damage' in stats2) stats2.damage = Math.round((stats2.damage as number) * 1.15);
      if ('armorClass' in stats2) stats2.armorClass = (stats2.armorClass as number) + 5;
      overrides.stats = stats2;
      overrides.mass = Math.round(baseModule.mass * 1.1 * 10) / 10;
      overrides.color = '#fbbf24';
      flavor = 'Battle-hardened systems resist damage and hit harder';
      break;
    }
    case 'juggernaut': {
      overrides.maxHp = Math.round(baseModule.maxHp * 1.6);
      const stats3 = { ...baseModule.stats };
      if ('armorClass' in stats3) stats3.armorClass = (stats3.armorClass as number) + 10;
      overrides.stats = stats3;
      overrides.mass = Math.round(baseModule.mass * 1.4 * 10) / 10;
      overrides.color = '#dc2626';
      flavor = 'Heavy armor plating makes this module nearly indestructible';
      break;
    }
    default: {
      overrides.maxHp = Math.round(baseModule.maxHp * 1.1);
      overrides.color = '#c084fc';
      flavor = 'Unknown corruption trace';
      break;
    }
  }

  return { statOverrides: overrides, flavor };
}

// ── Name Generation ─────────────────────────────────────────

const AFFIX_MODULE_PREFIXES: Record<string, string[]> = {
  tough:        ['Fortified', 'Hardened', 'Reinforced'],
  aggressive:   ['Volatile', 'Razor', 'Scorched'],
  swift:        ['Stripped', 'Racing', 'Lightweight'],
  shielded:     ['Warded', 'Barried', 'Parasitic'],
  regenerating: ['Living', 'Biolume', 'Mending'],
  explosive:    ['Unstable', 'Detonator', 'Breach'],
  gunner:       ['Calibrated', 'Linked', 'Overclocked'],
  veteran:      ['Veteran', 'Battle-scarred', 'Tempered'],
  juggernaut:   ['Juggernaut', 'Monolith', 'Bastion'],
};

function generateCorruptedName(
  baseName: string,
  affixId: string,
  seed: number,
): string {
  const prefixes = AFFIX_MODULE_PREFIXES[affixId] ?? ['Corrupted'];
  const prefix = prefixes[Math.abs(seed) % prefixes.length];
  return `${prefix} ${baseName}`;
}

// ── Core Extraction ──────────────────────────────────────────

export interface ExtractionInput {
  /** The enemy's blueprint (to pick a module from). */
  enemyBlueprint: { modules: Array<{ definitionId: string }> };
  /** Module catalog for looking up base definitions. */
  getModuleDef: (id: string) => ModuleDefinition | undefined;
  /** The affix(es) the enemy had. Pick the strongest for extraction. */
  affixIds: string[];
  affixColors: Record<string, string>;
  affixDisplayNames: Record<string, string>;
  /** Whether the enemy was a boss. */
  isBoss: boolean;
  /** Wave number. */
  waveNumber: number;
  /** RNG seed for deterministic extraction. */
  rng: number;
}

/**
 * Extract a corrupted module from a salvaged enemy.
 * Picks the most impactful module from the enemy's loadout,
 * applies the strongest affix's properties, and returns
 * a CorruptedModule ready for the player's locker.
 *
 * Returns null if no extractable module is found.
 */
export function extractCorruptedModule(input: ExtractionInput): CorruptedModule | null {
  // Pick the best affix (prefer later-wave affixes which are rarer)
  const AFFIX_PRIORITY = ['juggernaut', 'gunner', 'explosive', 'regenerating', 'veteran', 'shielded', 'swift', 'aggressive', 'tough'];
  const sortedAffixes = [...input.affixIds].sort(
    (a, b) => AFFIX_PRIORITY.indexOf(a) - AFFIX_PRIORITY.indexOf(b),
  );
  const bestAffix = sortedAffixes[0];
  if (!bestAffix) return null;

  // Pick a module from the enemy's loadout, preferring weapons > reactors > engines > hull
  const CATEGORY_PRIORITY: Record<string, number> = {
    weapon: 0, reactor: 1, engine: 2, shield: 3, drone_bay: 4, armor: 5, hull: 6, bridge: 7,
  };
  const enemyModules = input.enemyBlueprint.modules
    .map((m) => ({ ...m, def: input.getModuleDef(m.definitionId) }))
    .filter((m) => m.def != null && m.def.category !== 'bridge');

  if (enemyModules.length === 0) return null;

  // Bosses always give their most impactful module
  if (input.isBoss) {
    enemyModules.sort((a, b) => (CATEGORY_PRIORITY[a.def!.category] ?? 9) - (CATEGORY_PRIORITY[b.def!.category] ?? 9));
  } else {
    // Non-boss: random pick weighted toward lower-priority categories
    const pickIdx = Math.abs(Math.floor(input.rng * 1000)) % enemyModules.length;
    const picked = enemyModules[pickIdx];
    enemyModules.length = 0;
    enemyModules.push(picked);
  }

  const chosen = enemyModules[0];
  if (!chosen.def) return null;

  const extraction = extractAffixProperties(bestAffix, chosen.def);
  const corruptedDef: ModuleDefinition = {
    ...chosen.def,
    ...extraction.statOverrides,
    id: `lineage:${bestAffix}_${chosen.def.id}_${Date.now()}`,
    description: extraction.flavor,
  };

  const seed = Math.abs(Math.floor(input.rng * 100000));
  const displayName = generateCorruptedName(chosen.def.displayName, bestAffix, seed);

  return {
    id: crypto.randomUUID(),
    baseModuleId: chosen.def.id,
    displayName,
    category: chosen.def.category,
    footprint: chosen.def.footprint,
    definition: corruptedDef,
    sourceAffix: input.affixDisplayNames[bestAffix] ?? bestAffix,
    sourceColor: input.affixColors[bestAffix] ?? '#c084fc',
    wasBoss: input.isBoss,
    waveNumber: input.waveNumber,
    extractedAt: Date.now(),
  };
}

// ── Locker Management ───────────────────────────────────────

export const LINEAGE_STORAGE_KEY = 'spachip3js.lineage';

export const DEFAULT_LINEAGE_LOCKER: LineageLocker = {
  modules: [],
};

export const MAX_LOCKER_SIZE = 24;

export function loadLineageLocker(): LineageLocker {
  try {
    const saved = globalThis.localStorage.getItem(LINEAGE_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_LINEAGE_LOCKER };
    const data = JSON.parse(saved) as Partial<LineageLocker>;
    return {
      modules: Array.isArray(data.modules) ? data.modules : [],
    };
  } catch {
    return { ...DEFAULT_LINEAGE_LOCKER };
  }
}

export function persistLineageLocker(locker: LineageLocker): void {
  globalThis.localStorage.setItem(LINEAGE_STORAGE_KEY, JSON.stringify(locker));
}

/**
 * Add a corrupted module to the locker. Evicts the oldest if full.
 */
export function addToLocker(
  locker: LineageLocker,
  module: CorruptedModule,
): LineageLocker {
  const modules = [...locker.modules, module];
  if (modules.length > MAX_LOCKER_SIZE) {
    modules.sort((a, b) => a.extractedAt - b.extractedAt);
    modules.splice(0, modules.length - MAX_LOCKER_SIZE);
  }
  return { modules };
}

/**
 * Remove a corrupted module from the locker by ID.
 */
export function removeFromLocker(
  locker: LineageLocker,
  moduleId: string,
): LineageLocker {
  return { modules: locker.modules.filter((m) => m.id !== moduleId) };
}

/**
 * Get corrupted modules filtered by category.
 */
export function getLockerByCategory(
  locker: LineageLocker,
  category?: ModuleCategory,
): CorruptedModule[] {
  if (!category) return locker.modules;
  return locker.modules.filter((m) => m.category === category);
}

// ── Query Helpers ────────────────────────────────────────────

export interface LineageSummary {
  totalExtracted: number;
  bossModules: number;
  byCategory: Record<string, number>;
}

export function getLineageSummary(locker: LineageLocker): LineageSummary {
  const byCategory: Record<string, number> = {};
  let bossModules = 0;
  for (const m of locker.modules) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
    if (m.wasBoss) bossModules++;
  }
  return {
    totalExtracted: locker.modules.length,
    bossModules,
    byCategory,
  };
}
