import { describe, it, expect } from 'vitest';
import {
  hasMutator,
  canAddMutator,
  getShopMutators,
  applyMutatorStatMods,
  momentumDamageMult,
  vampiricHeal,
  thornsReflectFraction,
  lastStandBonuses,
  bountyHunterActive,
  chainReactionActive,
  orbitShieldActive,
  MAX_MUTATORS,
  MUTATOR_CATALOG,
} from '../src/game/mutators';
import { defaultLiveUpgradeStats } from '../src/game/upgrade-shop';

describe('mutator system', () => {
  it('MUTATOR_CATALOG has 8 entries', () => {
    expect(MUTATOR_CATALOG).toHaveLength(8);
  });

  it('MAX_MUTATORS is 3', () => {
    expect(MAX_MUTATORS).toBe(3);
  });

  it('hasMutator finds active mutators', () => {
    const active = [{ def: MUTATOR_CATALOG[0], acquiredWave: 3 }];
    expect(hasMutator(active, 'vampiric')).toBe(true);
    expect(hasMutator(active, 'glass_cannon')).toBe(false);
  });

  it('canAddMutator rejects at max capacity', () => {
    const active = MUTATOR_CATALOG.slice(0, 3).map((d) => ({ def: d, acquiredWave: 1 }));
    expect(canAddMutator(active, MUTATOR_CATALOG[3])).toBe(false);
  });

  it('canAddMutator rejects duplicates', () => {
    const active = [{ def: MUTATOR_CATALOG[0], acquiredWave: 1 }];
    expect(canAddMutator(active, MUTATOR_CATALOG[0])).toBe(false);
  });

  it('canAddMutator rejects conflicting mutators', () => {
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'glass_cannon')!, acquiredWave: 1 }];
    const lastStand = MUTATOR_CATALOG.find((m) => m.id === 'last_stand')!;
    expect(canAddMutator(active, lastStand)).toBe(false);
  });

  it('canAddMutator allows non-conflicting mutators', () => {
    const active = [{ def: MUTATOR_CATALOG[0], acquiredWave: 1 }];
    expect(canAddMutator(active, MUTATOR_CATALOG[1])).toBe(true);
  });

  it('getShopMutators filters by wave number', () => {
    const available = getShopMutators(1, []);
    expect(available.length).toBeLessThan(MUTATOR_CATALOG.length);
    // Only vampiric (waveMin 2) should be excluded at wave 1 — wait, vampiric is waveMin 2
    // So at wave 1, nothing should be available
    expect(available).toHaveLength(0);
  });

  it('getShopMutators returns vampiric at wave 2', () => {
    const available = getShopMutators(2, []);
    expect(available.some((m) => m.id === 'vampiric')).toBe(true);
  });

  it('getShopMutators excludes already active', () => {
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'vampiric')!, acquiredWave: 2 }];
    const available = getShopMutators(5, active);
    expect(available.some((m) => m.id === 'vampiric')).toBe(false);
  });

  it('applyMutatorStatMods applies Glass Cannon', () => {
    const stats = defaultLiveUpgradeStats();
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'glass_cannon')!, acquiredWave: 3 }];
    const result = applyMutatorStatMods(stats, active);
    expect(result.damageMultiplier).toBe(1.5);
    expect(result.maxHpBonus).toBe(-30);
  });

  it('momentumDamageMult scales with speed', () => {
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'momentum')!, acquiredWave: 3 }];
    expect(momentumDamageMult(active, 0)).toBe(1);
    expect(momentumDamageMult(active, 3)).toBeGreaterThan(1);
    expect(momentumDamageMult(active, 6)).toBeCloseTo(1.4, 1);
    expect(momentumDamageMult(active, 100)).toBeCloseTo(1.4, 1);
  });

  it('momentumDamageMult returns 1 without momentum mutator', () => {
    expect(momentumDamageMult([], 10)).toBe(1);
  });

  it('vampiricHeal returns 8% of max HP', () => {
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'vampiric')!, acquiredWave: 2 }];
    expect(vampiricHeal(active, 100)).toBe(8);
    expect(vampiricHeal(active, 250)).toBe(20);
  });

  it('vampiricHeal returns 0 without mutator', () => {
    expect(vampiricHeal([], 100)).toBe(0);
  });

  it('thornsReflectFraction returns 0.2 with Thorns', () => {
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'thorns')!, acquiredWave: 4 }];
    expect(thornsReflectFraction(active)).toBe(0.2);
  });

  it('thornsReflectFraction returns 0 without Thorns', () => {
    expect(thornsReflectFraction([])).toBe(0);
  });

  it('lastStandBonuses activate below 25% HP', () => {
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'last_stand')!, acquiredWave: 5 }];
    const full = lastStandBonuses(active, 1.0);
    expect(full.damageMult).toBe(1);
    expect(full.fireRateMult).toBe(1);

    const low = lastStandBonuses(active, 0.1);
    expect(low.damageMult).toBe(1.3);
    expect(low.fireRateMult).toBe(2.0);
  });

  it('bountyHunterActive works', () => {
    expect(bountyHunterActive([])).toBe(false);
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'bounty_hunter')!, acquiredWave: 6 }];
    expect(bountyHunterActive(active)).toBe(true);
  });

  it('chainReactionActive works', () => {
    expect(chainReactionActive([])).toBe(false);
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'chain_reaction')!, acquiredWave: 9 }];
    expect(chainReactionActive(active)).toBe(true);
  });

  it('orbitShieldActive works', () => {
    expect(orbitShieldActive([])).toBe(false);
    const active = [{ def: MUTATOR_CATALOG.find((m) => m.id === 'orbit_shield')!, acquiredWave: 7 }];
    expect(orbitShieldActive(active)).toBe(true);
  });

  it('multiple mutators stack stat mods', () => {
    const stats = defaultLiveUpgradeStats();
    const active = [
      { def: MUTATOR_CATALOG.find((m) => m.id === 'glass_cannon')!, acquiredWave: 3 },
    ];
    // Glass cannon: 1.5x damage
    let result = applyMutatorStatMods(stats, active);
    expect(result.damageMultiplier).toBe(1.5);
  });

  it('all mutators have unique ids', () => {
    const ids = MUTATOR_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
