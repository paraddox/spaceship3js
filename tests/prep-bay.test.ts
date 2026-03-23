import { describe, expect, it } from 'vitest';
import { buildWingmanConfig, getPrepBaySummary, sortPrepBayEntries } from '../src/game/prep-bay';
import { DEFAULT_LEGACY_STATE } from '../src/game/legacy';
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
});
