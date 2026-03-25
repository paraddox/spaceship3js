import {
  getLegacySummary,
  getMilestoneProgress,
  getStartingBonusDef,
  isMilestoneCompleted,
  MILESTONES,
  type LegacyState,
  type MilestoneDef,
} from './legacy';
import {
  RARITY_CONFIG,
  type SalvageCollection,
  type SalvagedBlueprint,
} from './salvage';
import type { WingmanConfig } from './wingman';
import type { LineageLocker } from './lineage';
import type { MutagenState } from './mutagen';

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

export interface LineageSummary {
  totalModules: number;
  bossModules: number;
  weaponModules: number;
  utilityModules: number;
  latestWave: number;
}

export interface PrepLoadoutSummary {
  wingmanAssigned: boolean;
  wingmanName: string | null;
  activeBonuses: number;
  mutationCount: number;
  pendingEssence: number;
  corruptedModules: number;
}

export interface LegacyCodexMilestoneSummary {
  id: string;
  displayName: string;
  icon: string;
  description: string;
  hint: string;
  completed: boolean;
  rewardId: MilestoneDef['unlocks'];
  rewardName: string;
  rewardIcon: string;
  rewardAlreadyUnlocked: boolean;
  rewardActive: boolean;
}

export interface LegacyCodexCategorySummary {
  id: MilestoneDef['category'];
  label: string;
  icon: string;
  total: number;
  completed: number;
  milestones: LegacyCodexMilestoneSummary[];
}

export interface LegacyCodexSummary {
  total: number;
  completed: number;
  unlockedRewards: number;
  activeRewards: number;
  categories: LegacyCodexCategorySummary[];
}

const RARITY_SORT_ORDER: Record<keyof typeof RARITY_CONFIG, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

const LEGACY_CATEGORY_META: Record<MilestoneDef['category'], { label: string; icon: string }> = {
  combat: { label: 'Combat', icon: '⚔️' },
  survival: { label: 'Survival', icon: '🛡️' },
  economy: { label: 'Economy', icon: '💰' },
  mastery: { label: 'Mastery', icon: '🏆' },
};

const LEGACY_CATEGORY_ORDER: MilestoneDef['category'][] = ['combat', 'survival', 'economy', 'mastery'];

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

export function getLineageSummary(locker: LineageLocker): LineageSummary {
  const totalModules = locker.modules.length;
  const bossModules = locker.modules.filter((module) => module.wasBoss).length;
  const weaponModules = locker.modules.filter((module) => module.category === 'weapon').length;
  const utilityModules = locker.modules.filter((module) => module.category !== 'weapon').length;
  const latestWave = locker.modules.reduce((best, module) => Math.max(best, module.waveNumber), 0);
  return {
    totalModules,
    bossModules,
    weaponModules,
    utilityModules,
    latestWave,
  };
}

export function getPrepLoadoutSummary(
  legacy: LegacyState,
  wingmanConfig: WingmanConfig | null,
  mutagenState: MutagenState,
  lineageLocker: LineageLocker,
): PrepLoadoutSummary {
  return {
    wingmanAssigned: wingmanConfig != null,
    wingmanName: wingmanConfig?.name ?? null,
    activeBonuses: legacy.activeBonuses.length,
    mutationCount: mutagenState.mutations.length,
    pendingEssence: mutagenState.pendingEssence.length,
    corruptedModules: lineageLocker.modules.length,
  };
}

export function getLegacyCodexSummary(legacy: LegacyState): LegacyCodexSummary {
  const progress = getMilestoneProgress(legacy);
  const categories = LEGACY_CATEGORY_ORDER.map((category) => {
    const milestones = MILESTONES
      .filter((milestone) => milestone.category === category)
      .map((milestone) => {
        const reward = getStartingBonusDef(milestone.unlocks);
        const completed = isMilestoneCompleted(legacy, milestone.id);
        return {
          id: milestone.id,
          displayName: milestone.displayName,
          icon: milestone.icon,
          description: milestone.description,
          hint: milestone.hint,
          completed,
          rewardId: milestone.unlocks,
          rewardName: reward?.displayName ?? milestone.unlocks,
          rewardIcon: reward?.icon ?? '✨',
          rewardAlreadyUnlocked: legacy.unlockedBonuses.includes(milestone.unlocks),
          rewardActive: legacy.activeBonuses.includes(milestone.unlocks),
        } satisfies LegacyCodexMilestoneSummary;
      });
    const meta = LEGACY_CATEGORY_META[category];
    return {
      id: category,
      label: meta.label,
      icon: meta.icon,
      total: milestones.length,
      completed: milestones.filter((milestone) => milestone.completed).length,
      milestones,
    } satisfies LegacyCodexCategorySummary;
  });

  return {
    total: progress.total,
    completed: progress.completed,
    unlockedRewards: legacy.unlockedBonuses.length,
    activeRewards: legacy.activeBonuses.length,
    categories,
  };
}
