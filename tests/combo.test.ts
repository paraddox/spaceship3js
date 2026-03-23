import { describe, it, expect } from 'vitest';
import {
  createComboState,
  registerComboKill,
  tickCombo,
  getComboTier,
  getComboCreditMultiplier,
  getComboTimerFraction,
  resetCombo,
  COMBO_TIERS,
} from '../src/game/combo';

describe('combo system', () => {
  it('starts with zero kills and no timer', () => {
    const s = createComboState();
    expect(s.kills).toBe(0);
    expect(s.timer).toBe(0);
    expect(s.bestKills).toBe(0);
    expect(s.totalComboScore).toBe(0);
  });

  it('first kill does not activate combo', () => {
    const { state, tierUp } = registerComboKill(createComboState());
    expect(state.kills).toBe(1);
    expect(state.timer).toBe(0); // no timer at 1 kill
    expect(tierUp).toBe(false);
    expect(getComboTier(1).multiplier).toBe(1);
  });

  it('second kill activates combo (x1.5)', () => {
    let s = createComboState();
    s = registerComboKill(s).state;
    const { state, tierUp } = registerComboKill(s);
    expect(state.kills).toBe(2);
    expect(tierUp).toBe(true);
    expect(getComboTier(2).label).toBe('Double Tap');
    expect(getComboTier(2).multiplier).toBe(1.5);
    expect(state.timer).toBeGreaterThan(0);
  });

  it('tracks best kills across run', () => {
    let s = createComboState();
    for (let i = 0; i < 5; i++) s = registerComboKill(s).state;
    expect(s.bestKills).toBe(5);
    // After reset
    s = resetCombo();
    for (let i = 0; i < 3; i++) s = registerComboKill(s).state;
    expect(s.bestKills).toBe(3); // best resets on resetCombo
  });

  it('tier upgrades happen at correct thresholds', () => {
    const thresholds = [2, 5, 10, 15, 20];
    let s = createComboState();
    for (const threshold of thresholds) {
      while (s.kills < threshold) {
        const r = registerComboKill(s);
        s = r.state;
      }
      expect(getComboTier(s.kills).minKills).toBe(threshold);
    }
  });

  it('timer ticks down and combo expires', () => {
    let s = createComboState();
    for (let i = 0; i < 3; i++) s = registerComboKill(s).state;
    expect(s.kills).toBe(3);
    expect(s.timer).toBeGreaterThan(0);
    // Tick until expired
    for (let i = 0; i < 100; i++) {
      s = tickCombo(s, 0.1);
    }
    expect(s.kills).toBe(0);
    expect(s.timer).toBe(0);
  });

  it('credit multiplier matches tier', () => {
    expect(getComboCreditMultiplier(0)).toBe(1);
    expect(getComboCreditMultiplier(1)).toBe(1);
    expect(getComboCreditMultiplier(3)).toBe(1.5);
    expect(getComboCreditMultiplier(7)).toBe(2);
    expect(getComboCreditMultiplier(12)).toBe(3);
    expect(getComboCreditMultiplier(17)).toBe(4);
    expect(getComboCreditMultiplier(22)).toBe(5);
  });

  it('score accumulates during combo', () => {
    let s = createComboState();
    // Kill 3 enemies (combo activates at 2)
    for (let i = 0; i < 3; i++) s = registerComboKill(s).state;
    expect(s.totalComboScore).toBeGreaterThan(0);
  });

  it('timer fraction is 0-1', () => {
    let s = createComboState();
    for (let i = 0; i < 3; i++) s = registerComboKill(s).state;
    const frac = getComboTimerFraction(s);
    expect(frac).toBeGreaterThan(0);
    expect(frac).toBeLessThanOrEqual(1);
  });

  it('timer fraction is 0 for inactive combo', () => {
    expect(getComboTimerFraction(createComboState())).toBe(0);
    let s = createComboState();
    s = registerComboKill(s).state; // 1 kill, no combo
    expect(getComboTimerFraction(s)).toBe(0);
  });

  it('higher combos give longer timer', () => {
    let s5 = createComboState();
    let s10 = createComboState();
    for (let i = 0; i < 5; i++) s5 = registerComboKill(s5).state;
    for (let i = 0; i < 10; i++) s10 = registerComboKill(s10).state;
    expect(s10.timer).toBeGreaterThan(s5.timer);
  });

  it('all combo tiers have valid data', () => {
    for (const tier of COMBO_TIERS) {
      expect(tier.minKills).toBeGreaterThanOrEqual(0);
      expect(tier.multiplier).toBeGreaterThanOrEqual(1);
      expect(tier.label).toBeTruthy();
      expect(tier.color).toBeTruthy();
      expect(tier.icon).toBeTruthy();
    }
  });

  it('tier announcement appears and fades', () => {
    let s = createComboState();
    s = registerComboKill(s).state; // kill 1
    expect(s.tierAnnouncement).toBe('');
    s = registerComboKill(s).state; // kill 2 - tier up
    expect(s.tierAnnouncement).toBeTruthy();
    // Tick until announcement fades
    s = tickCombo(s, 3);
    expect(s.tierAnnouncement).toBe('');
  });

  it('resetCombo returns fresh state', () => {
    let s = createComboState();
    for (let i = 0; i < 10; i++) s = registerComboKill(s).state;
    expect(s.kills).toBe(10);
    const fresh = resetCombo();
    expect(fresh.kills).toBe(0);
    expect(fresh.bestKills).toBe(0);
    expect(fresh.totalComboScore).toBe(0);
  });
});
