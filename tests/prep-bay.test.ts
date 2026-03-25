import { describe, expect, it } from 'vitest';
import { buildWingmanConfig, getLegacyCodexSummary, getLineageSummary, getPrepBaySummary, getPrepLoadoutSummary, sortPrepBayEntries } from '../src/game/prep-bay';
import { DEFAULT_LEGACY_STATE } from '../src/game/legacy';
import { createMutagenState } from '../src/game/mutagen';
import type { LineageLocker } from '../src/game/lineage';
import type { SalvagedBlueprint } from '../src/game/salvage';
import type { ShipBlueprint } from '../src/core/types';

const BASE_BLUEPRINT: ShipBlueprint = {
  name: 'Raider',
  crew: { pilot: 1, gunner: 1, engineer: 1, tactician: 1 },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
  ],
};

function makeEntry(id: string, rarity: SalvagedBlueprint['rarity'], salvagedAt: number): SalvagedBlueprint {
  return {
    id,
    blueprint: { ...BASE_BLUEPRINT, name: `${id}-bp` },
    rarity,
    name: `${rarity}-${id}`,
    waveNumber: 6,
    wasBoss: rarity === 'legendary',
    affixNames: [],
    salvagedAt,
    runNumber: 1,
  };
}

const SAMPLE_LOCKER: LineageLocker = {
  modules: [
    {
      id: 'c1',
      baseModuleId: 'core:laser_light',
      displayName: 'Volatile Light Laser',
      category: 'weapon',
      footprint: [{ q: 0, r: 0 }],
      definition: {
        id: 'lineage:c1',
        displayName: 'Volatile Light Laser',
        category: 'weapon',
        footprint: [{ q: 0, r: 0 }],
        description: 'Corrupted test weapon',
        maxHp: 42,
        mass: 4,
        heatCapacity: 8,
        color: '#f97316',
        stats: { damage: 18 },
      },
      sourceAffix: 'Aggressive',
      sourceColor: '#f97316',
      wasBoss: false,
      waveNumber: 7,
      extractedAt: 100,
    },
    {
      id: 'c2',
      baseModuleId: 'core:reactor_small',
      displayName: 'Bastion Reactor',
      category: 'reactor',
      footprint: [{ q: 0, r: 0 }],
      definition: {
        id: 'lineage:c2',
        displayName: 'Bastion Reactor',
        category: 'reactor',
        footprint: [{ q: 0, r: 0 }],
        description: 'Corrupted test utility',
        maxHp: 60,
        mass: 6,
        heatCapacity: 12,
        color: '#dc2626',
        powerOutput: 18,
        stats: {},
      },
      sourceAffix: 'Juggernaut',
      sourceColor: '#dc2626',
      wasBoss: true,
      waveNumber: 11,
      extractedAt: 200,
    },
  ],
};

describe('prep bay helpers', () => {
  it('builds a wingman config from salvage rarity', () => {
    const config = buildWingmanConfig(makeEntry('a', 'epic', 10));
    expect(config).toEqual({
      blueprintId: 'a',
      name: 'epic-a',
      color: '#c084fc',
    });
  });

  it('sorts active wingman first, then rarity, then newest', () => {
    const entries = [
      makeEntry('common', 'common', 100),
      makeEntry('legendary', 'legendary', 50),
      makeEntry('epic', 'epic', 200),
    ];
    const sorted = sortPrepBayEntries(entries, 'common');
    expect(sorted.map((entry) => entry.id)).toEqual(['common', 'legendary', 'epic']);
  });

  it('summarizes legacy and salvage state for the prep bay', () => {
    const summary = getPrepBaySummary(
      { entries: [makeEntry('a', 'rare', 1)], totalAttempts: 3, totalSalvaged: 1 },
      {
        ...DEFAULT_LEGACY_STATE,
        totalXp: 120,
        bestWave: 9,
        unlockedBonuses: ['quick_start', 'shield_seed'],
        activeBonuses: ['quick_start'],
        completedMilestones: [{ milestoneId: 'first_blood', completedAt: 1, runNumber: 1 }],
      },
      { blueprintId: 'a', name: 'rare-a', color: '#60a5fa' },
    );

    expect(summary.bestWave).toBe(9);
    expect(summary.salvageTotal).toBe(1);
    expect(summary.bonusesActive).toBe(1);
    expect(summary.bonusesUnlocked).toBe(2);
    expect(summary.wingmanName).toBe('rare-a');
    expect(summary.rankLabel).toContain('Lv.');
  });

  it('summarizes corrupted lineage inventory for prep surfacing', () => {
    const summary = getLineageSummary(SAMPLE_LOCKER);
    expect(summary.totalModules).toBe(2);
    expect(summary.bossModules).toBe(1);
    expect(summary.weaponModules).toBe(1);
    expect(summary.utilityModules).toBe(1);
    expect(summary.latestWave).toBe(11);
  });

  it('summarizes active endless loadout bridges', () => {
    const mutagenState = {
      ...createMutagenState(),
      mutations: [{ id: 'tough' as const, stacks: 2 }],
      pendingEssence: [{ affixId: 'swift' as const, collectedAt: 10, waveNumber: 8 }],
    };
    const summary = getPrepLoadoutSummary(
      {
        ...DEFAULT_LEGACY_STATE,
        activeBonuses: ['quick_start', 'combo_starter'],
      },
      { blueprintId: 'wing-a', name: 'Escort Relic', color: '#60a5fa' },
      mutagenState,
      SAMPLE_LOCKER,
    );

    expect(summary.wingmanAssigned).toBe(true);
    expect(summary.wingmanName).toBe('Escort Relic');
    expect(summary.activeBonuses).toBe(2);
    expect(summary.mutationCount).toBe(1);
    expect(summary.pendingEssence).toBe(1);
    expect(summary.corruptedModules).toBe(2);
  });

  it('builds a full legacy codex summary with category and reward state', () => {
    const codex = getLegacyCodexSummary({
      ...DEFAULT_LEGACY_STATE,
      unlockedBonuses: ['quick_start', 'shield_seed'],
      activeBonuses: ['quick_start'],
      completedMilestones: [
        { milestoneId: 'first_blood', completedAt: 1, runNumber: 1 },
        { milestoneId: 'wave_5', completedAt: 2, runNumber: 2 },
      ],
    });

    expect(codex.completed).toBe(2);
    expect(codex.unlockedRewards).toBe(2);
    expect(codex.activeRewards).toBe(1);
    expect(codex.categories.map((category) => category.id)).toEqual(['combat', 'survival', 'economy', 'mastery']);

    const combat = codex.categories[0];
    expect(combat.label).toBe('Combat');
    expect(combat.completed).toBe(1);
    expect(combat.milestones.find((milestone) => milestone.id === 'first_blood')).toMatchObject({
      completed: true,
      rewardName: 'Quick Start',
      rewardAlreadyUnlocked: true,
      rewardActive: true,
    });

    const survival = codex.categories[1];
    expect(survival.milestones.find((milestone) => milestone.id === 'wave_5')).toMatchObject({
      completed: true,
      rewardName: 'Shield Seed',
      rewardAlreadyUnlocked: true,
      rewardActive: false,
    });

    const economyMilestone = codex.categories[2].milestones.find((milestone) => milestone.id === 'wealthy');
    expect(economyMilestone).toMatchObject({
      completed: false,
      rewardName: 'Quick Start',
      rewardAlreadyUnlocked: true,
    });
  });
});
