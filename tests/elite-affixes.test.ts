import { describe, it, expect } from 'vitest';
import {
  rollAffixes,
  computeAffixStats,
  eliteCreditsMultiplier,
  affixDisplayLabel,
  isElite,
  getAffixColor,
  affixChance,
  getAvailableAffixes,
  AFFIX_CATALOG,
} from '../src/game/elite-affixes';

describe('elite affix system', () => {
  it('no affixes at wave 1 or 2', () => {
    for (let w = 1; w <= 2; w++) {
      for (let i = 0; i < 20; i++) {
        const affixes = rollAffixes(w, false, w * 100 + i);
        expect(affixes).toHaveLength(0);
      }
    }
  });

  it('affixes can appear from wave 3+', () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const affixes = rollAffixes(3, false, 300 + i);
      if (affixes.length > 0) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('boss waves always get affixes at wave 5+', () => {
    for (let i = 0; i < 20; i++) {
      const affixes = rollAffixes(5, true, 500 + i);
      expect(affixes.length).toBeGreaterThan(0);
    }
  });

  it('elite enemies can have 2 affixes', () => {
    let foundElite = false;
    for (let i = 0; i < 500; i++) {
      const affixes = rollAffixes(10, false, 1000 + i);
      if (affixes.length >= 2) { foundElite = true; break; }
    }
    expect(foundElite).toBe(true);
  });

  it('never rolls more than 2 affixes', () => {
    for (let i = 0; i < 500; i++) {
      const affixes = rollAffixes(20, false, 2000 + i);
      expect(affixes.length).toBeLessThanOrEqual(2);
    }
  });

  it('computeAffixStats multiplies correctly', () => {
    const result = computeAffixStats([
      { def: AFFIX_CATALOG.find(a => a.id === 'tough')! },
    ]);
    expect(result.hpMultiplier).toBe(1.5);
    expect(result.damageMultiplier).toBe(1);
    expect(result.regeneratesHp).toBe(false);
  });

  it('computeAffixStats with multiple affixes stacks multipliers', () => {
    const result = computeAffixStats([
      { def: AFFIX_CATALOG.find(a => a.id === 'tough')! },      // hp 1.5
      { def: AFFIX_CATALOG.find(a => a.id === 'aggressive')! },  // dmg 1.3, fireRate 1.25
    ]);
    expect(result.hpMultiplier).toBe(1.5);
    expect(result.damageMultiplier).toBe(1.3);
    expect(result.fireRateMultiplier).toBe(1.25);
    expect(result.armorBonus).toBe(0);
  });

  it('elite credits multiplier scales with affix count', () => {
    expect(eliteCreditsMultiplier([])).toBe(1);
    expect(eliteCreditsMultiplier([{ def: AFFIX_CATALOG[0] }])).toBe(1.5);
    expect(eliteCreditsMultiplier([
      { def: AFFIX_CATALOG[0] },
      { def: AFFIX_CATALOG[1] },
    ])).toBe(2);
  });

  it('isElite returns true for 2+ affixes', () => {
    expect(isElite([])).toBe(false);
    expect(isElite([{ def: AFFIX_CATALOG[0] }])).toBe(false);
    expect(isElite([{ def: AFFIX_CATALOG[0] }, { def: AFFIX_CATALOG[1] }])).toBe(true);
  });

  it('getAffixColor returns last affix color', () => {
    expect(getAffixColor([])).toBe('');
    const single = [{ def: AFFIX_CATALOG[0] }];
    expect(getAffixColor(single)).toBe(AFFIX_CATALOG[0].color);
    const multi = [{ def: AFFIX_CATALOG[0] }, { def: AFFIX_CATALOG[1] }];
    expect(getAffixColor(multi)).toBe(AFFIX_CATALOG[1].color);
  });

  it('affixDisplayLabel formats correctly', () => {
    expect(affixDisplayLabel([])).toBe('');
    const single = [{ def: AFFIX_CATALOG[0] }];
    expect(affixDisplayLabel(single)).toContain(AFFIX_CATALOG[0].displayName);
  });

  it('getAvailableAffixes respects minWave', () => {
    expect(getAvailableAffixes(1)).toHaveLength(0);
    expect(getAvailableAffixes(3).length).toBeLessThan(AFFIX_CATALOG.length);
    expect(getAvailableAffixes(99)).toHaveLength(AFFIX_CATALOG.length);
  });

  it('affixChance increases with wave number', () => {
    const c3 = affixChance(3, false);
    const c10 = affixChance(10, false);
    expect(c10).toBeGreaterThan(c3);
    expect(affixChance(1, true)).toBe(1);
  });

  it('deterministic rolls: same seed = same result', () => {
    for (let i = 0; i < 50; i++) {
      const a = rollAffixes(10, false, i);
      const b = rollAffixes(10, false, i);
      expect(a.length).toBe(b.length);
      for (let j = 0; j < a.length; j++) {
        expect(a[j].def.id).toBe(b[j].def.id);
      }
    }
  });
});
