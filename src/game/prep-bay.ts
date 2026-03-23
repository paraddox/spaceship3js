import {
  getLegacySummary,
  getMilestoneProgress,
  type LegacyState,
} from './legacy';
import {
  RARITY_CONFIG,
  type SalvageCollection,
  type SalvagedBlueprint,
} from './salvage';
import type { WingmanConfig } from './wingman';

export interface PrepBaySummary {
  rankLabel: string;
  bestWave: number;
  salvageTotal: number;
  bonusesActive: number;
  bonusesUnlocked: number;
  milestonesCompleted: number;
  milestonesTotal: number;
  wingmanName: string | null;
  wingmanColor: string | null;
}

const RARITY_SORT_ORDER: Record<keyof typeof RARITY_CONFIG, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export function buildWingmanConfig(entry: SalvagedBlueprint): WingmanConfig {
  return {
    blueprintId: entry.id,
    name: entry.name,
    color: RARITY_CONFIG[entry.rarity].color,
  };
}

export function sortPrepBayEntries(entries: SalvagedBlueprint[], activeWingmanId: string | null): SalvagedBlueprint[] {
  return [...entries].sort((a, b) => {
    const aWingman = a.id === activeWingmanId ? 1 : 0;
    const bWingman = b.id === activeWingmanId ? 1 : 0;
    if (aWingman !== bWingman) return bWingman - aWingman;

    const rarityDiff = RARITY_SORT_ORDER[b.rarity] - RARITY_SORT_ORDER[a.rarity];
    if (rarityDiff !== 0) return rarityDiff;

    return b.salvagedAt - a.salvagedAt;
  });
}

export function getPrepBaySummary(
  collection: SalvageCollection,
  legacy: LegacyState,
  wingmanConfig: WingmanConfig | null,
): PrepBaySummary {
  const legacySummary = getLegacySummary(legacy);
  const milestoneProgress = getMilestoneProgress(legacy);
  return {
    rankLabel: `${legacySummary.rank.icon} ${legacySummary.rank.name} Lv.${legacySummary.level}`,
    bestWave: legacySummary.bestWave,
    salvageTotal: collection.entries.length,
    bonusesActive: legacy.activeBonuses.length,
    bonusesUnlocked: legacy.unlockedBonuses.length,
    milestonesCompleted: milestoneProgress.completed,
    milestonesTotal: milestoneProgress.total,
    wingmanName: wingmanConfig?.name ?? null,
    wingmanColor: wingmanConfig?.color ?? null,
  };
}
