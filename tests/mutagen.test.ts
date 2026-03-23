import { describe, it, expect } from 'vitest';
import {
  createMutagenState,
  collectEssenceFromKill,
  absorbEssence,
  computeMutagenStats,
  getMutationStacks,
  hasMutations,
  hasDeathExplosion,
  getDeathExplosionDamage,
  getHpRegenRate,
  canAbsorbNew,
  MAX_UNIQUE_MUTATIONS,
  MAX_ESSENCE_SLOTS,
  loadMutagenState,
  persistMutagenState,
  type MutagenState,
  type Mutation,
} from '../src/game/mutagen';

// ── State Management ──────────────────────────────────────────

describe('createMutagenState', () => {
  it('returns empty default state', () => {
    const state = createMutagenState();
    expect(state.mutations).toEqual([]);
    expect(state.pendingEssence).toEqual([]);
    expect(state.totalAbsorbed).toBe(0);
    expect(state.totalEssenceCollected).toBe(0);
  });
});

// ── Essence Collection ────────────────────────────────────────

describe('collectEssenceFromKill', () => {
  it('does nothing with no affixes', () => {
    const state = createMutagenState();
    const result = collectEssenceFromKill(state, [], false, 5);
    expect(result.pendingEssence).toHaveLength(0);
  });

  it('collects 1 essence for elite kill', () => {
    const state = createMutagenState();
    const result = collectEssenceFromKill(state, ['tough', 'aggressive'], false, 5);
    expect(result.pendingEssence).toHaveLength(1);
    expect(result.pendingEssence[0].waveNumber).toBe(5);
    expect(['tough', 'aggressive']).toContain(result.pendingEssence[0].affixId);
    expect(result.totalEssenceCollected).toBe(1);
  });

  it('collects all essences for boss kill', () => {
    const state = createMutagenState();
    const result = collectEssenceFromKill(state, ['tough', 'shielded'], true, 10);
    expect(result.pendingEssence).toHaveLength(2);
    expect(result.totalEssenceCollected).toBe(2);
  });

  it('respects max essence slots', () => {
    let state = createMutagenState();
    // Fill up to max
    state = collectEssenceFromKill(state, ['tough'], false, 1);
    state = collectEssenceFromKill(state, ['tough'], false, 2);
    state = collectEssenceFromKill(state, ['tough'], false, 3);
    expect(state.pendingEssence).toHaveLength(MAX_ESSENCE_SLOTS);
    // Fourth should not fit
    const result = collectEssenceFromKill(state, ['aggressive'], false, 4);
    expect(result.pendingEssence).toHaveLength(MAX_ESSENCE_SLOTS);
  });

  it('boss drops are capped by remaining slots', () => {
    let state = createMutagenState();
    state = collectEssenceFromKill(state, ['tough'], false, 1);
    state = collectEssenceFromKill(state, ['aggressive'], false, 2);
    // 2/3 slots used, boss with 3 affixes → only 1 fits
    const result = collectEssenceFromKill(state, ['shielded', 'regenerating', 'explosive'], true, 5);
    expect(result.pendingEssence).toHaveLength(MAX_ESSENCE_SLOTS);
    // Boss has 3 affixes but only 1 slot available → only 1 essence collected
    expect(result.totalEssenceCollected).toBe(3);
  });
});

// ── Absorption ────────────────────────────────────────────────

describe('absorbEssence', () => {
  it('creates new mutation from first absorption', () => {
    let state = collectEssenceFromKill(createMutagenState(), ['tough'], false, 5);
    state = absorbEssence(state, 0);
    expect(state.mutations).toHaveLength(1);
    expect(state.mutations[0].id).toBe('tough');
    expect(state.mutations[0].stacks).toBe(1);
    expect(state.pendingEssence).toHaveLength(0);
    expect(state.totalAbsorbed).toBe(1);
  });

  it('stacks onto existing mutation', () => {
    let state = collectEssenceFromKill(createMutagenState(), ['tough'], false, 5);
    state = absorbEssence(state, 0);
    state = collectEssenceFromKill(state, ['tough'], false, 8);
    state = absorbEssence(state, 0);
    expect(state.mutations).toHaveLength(1);
    expect(state.mutations[0].stacks).toBe(2);
    expect(state.totalAbsorbed).toBe(2);
  });

  it('allows up to MAX_UNIQUE_MUTATIONS unique types', () => {
    let state = createMutagenState();
    const ids = ['tough', 'aggressive', 'swift', 'shielded', 'veteran', 'regenerating'];
    for (const id of ids) {
      state = collectEssenceFromKill(state, [id], false, 1);
      state = absorbEssence(state, 0);
    }
    expect(state.mutations).toHaveLength(MAX_UNIQUE_MUTATIONS);
    expect(canAbsorbNew(state)).toBe(false);
  });

  it('rejects new unique mutation when at max', () => {
    let state = createMutagenState();
    const ids = ['tough', 'aggressive', 'swift', 'shielded', 'veteran', 'regenerating'];
    for (const id of ids) {
      state = collectEssenceFromKill(state, [id], false, 1);
      state = absorbEssence(state, 0);
    }
    // Try to add a 7th unique
    state = collectEssenceFromKill(state, ['explosive'], false, 20);
    const before = state.pendingEssence.length;
    state = absorbEssence(state, 0);
    // Should fail — state unchanged
    expect(state.mutations).toHaveLength(MAX_UNIQUE_MUTATIONS);
    expect(state.totalAbsorbed).toBe(6);
  });

  it('stacking onto existing still works when at max uniques', () => {
    let state = createMutagenState();
    const ids = ['tough', 'aggressive', 'swift', 'shielded', 'veteran', 'regenerating'];
    for (const id of ids) {
      state = collectEssenceFromKill(state, [id], false, 1);
      state = absorbEssence(state, 0);
    }
    // Stack onto existing 'tough'
    state = collectEssenceFromKill(state, ['tough'], false, 20);
    state = absorbEssence(state, 0);
    expect(state.mutations).toHaveLength(MAX_UNIQUE_MUTATIONS);
    expect(state.mutations.find(m => m.id === 'tough')!.stacks).toBe(2);
    expect(state.totalAbsorbed).toBe(7);
  });

  it('invalid index returns unchanged state', () => {
    let state = collectEssenceFromKill(createMutagenState(), ['tough'], false, 5);
    const before = absorbEssence(state, -1);
    expect(before.pendingEssence).toHaveLength(1);
    const after = absorbEssence(state, 5);
    expect(after.pendingEssence).toHaveLength(1);
  });
});

// ── Stat Computation ──────────────────────────────────────────

describe('computeMutagenStats', () => {
  it('returns identity with no mutations', () => {
    const mods = computeMutagenStats([]);
    expect(mods.maxHpMultiplier).toBe(1);
    expect(mods.damageMultiplier).toBe(1);
    expect(mods.fireRateMultiplier).toBe(1);
    expect(mods.thrustMultiplier).toBe(1);
    expect(mods.shieldMultiplier).toBe(1);
    expect(mods.armorBonus).toBe(0);
    expect(mods.hpRegenPerSecond).toBe(0);
    expect(mods.deathExplosionDamage).toBe(0);
  });

  it('tough: +8% HP per stack', () => {
    const mods = computeMutagenStats([{ id: 'tough', stacks: 3 }]);
    expect(mods.maxHpMultiplier).toBeCloseTo(1.24, 3);
  });

  it('aggressive: +6% damage per stack', () => {
    const mods = computeMutagenStats([{ id: 'aggressive', stacks: 2 }]);
    expect(mods.damageMultiplier).toBeCloseTo(1.12, 3);
  });

  it('swift: +5% thrust per stack', () => {
    const mods = computeMutagenStats([{ id: 'swift', stacks: 4 }]);
    expect(mods.thrustMultiplier).toBeCloseTo(1.20, 3);
  });

  it('shielded: +12% shield per stack', () => {
    const mods = computeMutagenStats([{ id: 'shielded', stacks: 2 }]);
    expect(mods.shieldMultiplier).toBeCloseTo(1.24, 3);
  });

  it('veteran: +5% dmg +4% HP per stack', () => {
    const mods = computeMutagenStats([{ id: 'veteran', stacks: 3 }]);
    expect(mods.damageMultiplier).toBeCloseTo(1.15, 3);
    expect(mods.maxHpMultiplier).toBeCloseTo(1.12, 3);
  });

  it('regenerating: +1% HP/sec per stack', () => {
    const mods = computeMutagenStats([{ id: 'regenerating', stacks: 5 }]);
    expect(mods.hpRegenPerSecond).toBeCloseTo(0.05, 3);
  });

  it('explosive: 15 damage per stack', () => {
    const mods = computeMutagenStats([{ id: 'explosive', stacks: 2 }]);
    expect(mods.deathExplosionDamage).toBe(30);
  });

  it('gunner: +5% fire rate per stack', () => {
    const mods = computeMutagenStats([{ id: 'gunner', stacks: 3 }]);
    expect(mods.fireRateMultiplier).toBeCloseTo(1.15, 3);
  });

  it('juggernaut: +6 armor, -2% thrust per stack', () => {
    const mods = computeMutagenStats([{ id: 'juggernaut', stacks: 4 }]);
    expect(mods.armorBonus).toBe(24);
    expect(mods.thrustMultiplier).toBeCloseTo(0.92, 3);
  });

  it('overcharged: +4% dmg, +3% fire rate per stack', () => {
    const mods = computeMutagenStats([{ id: 'overcharged', stacks: 2 }]);
    expect(mods.damageMultiplier).toBeCloseTo(1.08, 3);
    expect(mods.fireRateMultiplier).toBeCloseTo(1.06, 3);
  });

  it('multiple mutations stack multiplicatively', () => {
    const mods = computeMutagenStats([
      { id: 'aggressive', stacks: 2 },
      { id: 'veteran', stacks: 1 },
    ]);
    // aggressive 2 stacks: 1.12, veteran 1 stack: 1.05
    // Combined: 1.12 * 1.05 = 1.176
    expect(mods.damageMultiplier).toBeCloseTo(1.176, 3);
  });
});

// ── Query Helpers ─────────────────────────────────────────────

describe('getMutationStacks', () => {
  it('returns 0 for missing mutation', () => {
    expect(getMutationStacks([], 'tough')).toBe(0);
  });

  it('returns stack count for present mutation', () => {
    const mutations = [{ id: 'tough' as const, stacks: 4 }];
    expect(getMutationStacks(mutations, 'tough')).toBe(4);
  });
});

describe('hasMutations', () => {
  it('returns false for empty state', () => {
    expect(hasMutations(createMutagenState())).toBe(false);
  });

  it('returns true with mutations', () => {
    const state: MutagenState = { ...createMutagenState(), mutations: [{ id: 'tough', stacks: 1 }] };
    expect(hasMutations(state)).toBe(true);
  });
});

describe('hasDeathExplosion', () => {
  it('returns false without explosive mutation', () => {
    expect(hasDeathExplosion([])).toBe(false);
  });

  it('returns true with explosive mutation', () => {
    expect(hasDeathExplosion([{ id: 'explosive', stacks: 1 }])).toBe(true);
  });
});

describe('getDeathExplosionDamage', () => {
  it('returns 0 without explosive', () => {
    expect(getDeathExplosionDamage([])).toBe(0);
  });

  it('returns 15 per stack', () => {
    expect(getDeathExplosionDamage([{ id: 'explosive', stacks: 3 }])).toBe(45);
  });
});

describe('getHpRegenRate', () => {
  it('returns 0 without regenerating', () => {
    expect(getHpRegenRate([])).toBe(0);
  });

  it('returns 0.01 per stack', () => {
    expect(getHpRegenRate([{ id: 'regenerating', stacks: 3 }])).toBeCloseTo(0.03, 3);
  });
});

describe('canAbsorbNew', () => {
  it('returns true below max', () => {
    expect(canAbsorbNew(createMutagenState())).toBe(true);
  });

  it('returns false at max', () => {
    const state: MutagenState = {
      ...createMutagenState(),
      mutations: Array.from({ length: MAX_UNIQUE_MUTATIONS }, (_, i) => ({
        id: ['tough', 'aggressive', 'swift', 'shielded', 'veteran', 'regenerating'][i] as any,
        stacks: 1,
      })),
    };
    expect(canAbsorbNew(state)).toBe(false);
  });
});
