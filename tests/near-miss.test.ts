import { describe, it, expect } from 'vitest';
import {
  createNearMissState,
  checkNearMiss,
  tickNearMiss,
  getNearMissComboBonus,
  getEnemyTimeScale,
  NEAR_MISS_RADIUS,
  HIT_RADIUS,
  SLOW_MOTION_SCALE,
  SLOW_MOTION_DURATION,
  SLOW_MOTION_COOLDOWN,
  NEAR_MISS_COMBO_BONUS,
  STREAK_WINDOW,
  STREAK_DURATION_BONUS,
} from '../src/game/near-miss';

describe('createNearMissState', () => {
  it('returns fresh inactive state', () => {
    const s = createNearMissState();
    expect(s.active).toBe(false);
    expect(s.remaining).toBe(0);
    expect(s.cooldown).toBe(0);
    expect(s.total).toBe(0);
    expect(s.bestStreak).toBe(0);
    expect(s.currentStreak).toBe(0);
  });
});

describe('checkNearMiss', () => {
  it('triggers when projectile is in near-miss zone but not hit zone', () => {
    const s = createNearMissState();
    const result = checkNearMiss(s, 0.8);
    expect(result.triggered).toBe(true);
    expect(result.newState.active).toBe(true);
    expect(result.newState.total).toBe(1);
  });

  it('does not trigger when too far', () => {
    const result = checkNearMiss(createNearMissState(), NEAR_MISS_RADIUS + 0.1);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger when too close (actual hit)', () => {
    const result = checkNearMiss(createNearMissState(), HIT_RADIUS - 0.1);
    expect(result.triggered).toBe(false);
  });

  it('triggers when at exact boundary', () => {
    const result = checkNearMiss(createNearMissState(), NEAR_MISS_RADIUS - 0.01);
    expect(result.triggered).toBe(true);
  });

  it('does not trigger during cooldown', () => {
    const s = createNearMissState();
    s.cooldown = SLOW_MOTION_COOLDOWN;
    const result = checkNearMiss(s, 0.8);
    expect(result.triggered).toBe(false);
  });

  it('does not trigger while already active', () => {
    const s = createNearMissState();
    s.active = true;
    s.remaining = 0.3;
    const result = checkNearMiss(s, 0.8);
    expect(result.triggered).toBe(false);
  });

  it('starts cooldown on trigger', () => {
    const result = checkNearMiss(createNearMissState(), 0.8);
    expect(result.newState.cooldown).toBeCloseTo(SLOW_MOTION_COOLDOWN, 5);
  });

  it('increments streak within STREAK_WINDOW', () => {
    let s = checkNearMiss(createNearMissState(), 0.8).newState;
    // Simulate time passing less than STREAK_WINDOW
    s.timeSinceLastMiss = STREAK_WINDOW - 0.1;
    s.cooldown = 0;
    s.active = false;
    const result = checkNearMiss(s, 0.8);
    expect(result.triggered).toBe(true);
    expect(result.newState.currentStreak).toBe(2);
  });

  it('resets streak after STREAK_WINDOW expires', () => {
    let s = checkNearMiss(createNearMissState(), 0.8).newState;
    s.timeSinceLastMiss = STREAK_WINDOW + 0.1;
    s.cooldown = 0;
    s.active = false;
    const result = checkNearMiss(s, 0.8);
    expect(result.triggered).toBe(true);
    expect(result.newState.currentStreak).toBe(1);
  });

  it('updates best streak', () => {
    let s = createNearMissState();
    s = checkNearMiss(s, 0.8).newState; // streak 1
    s.timeSinceLastMiss = 0.5;
    s.cooldown = 0;
    s.active = false;
    s = checkNearMiss(s, 0.8).newState; // streak 2
    expect(s.bestStreak).toBe(2);
  });

  it('gives extra duration for streaks', () => {
    let s = createNearMissState();
    s.timeSinceLastMiss = 0.5;
    s = checkNearMiss(s, 0.8).newState;
    // First near-miss in streak window = streak 1, adds 0 bonus ticks
    expect(s.remaining).toBeCloseTo(SLOW_MOTION_DURATION, 5);
  });
});

describe('tickNearMiss', () => {
  it('returns timeScale 1 when inactive', () => {
    const { timeScale, state } = tickNearMiss(createNearMissState(), 0.1);
    expect(timeScale).toBe(1);
    expect(state).toEqual(expect.objectContaining({ active: false }));
  });

  it('ticks down cooldown when inactive', () => {
    let s = createNearMissState();
    s.cooldown = 1.0;
    s = tickNearMiss(s, 0.3).state;
    expect(s.cooldown).toBeCloseTo(0.7, 5);
  });

  it('returns slow timeScale when active', () => {
    let s = createNearMissState();
    s = checkNearMiss(s, 0.8).newState;
    // Tick past the ramp (80ms) to get full slow-mo
    const { timeScale } = tickNearMiss(s, 0.2);
    expect(timeScale).toBeCloseTo(SLOW_MOTION_SCALE, 2);
  });

  it('ramps smoothly into slow-mo', () => {
    let s = createNearMissState();
    s = checkNearMiss(s, 0.8).newState;
    // First tick at 16ms — should be partially ramped
    const { timeScale } = tickNearMiss(s, 0.016);
    expect(timeScale).toBeGreaterThan(SLOW_MOTION_SCALE);
    expect(timeScale).toBeLessThan(1);
  });

  it('deactivates when remaining reaches 0', () => {
    let s = createNearMissState();
    s = checkNearMiss(s, 0.8).newState;
    // Tick for longer than remaining
    s = tickNearMiss(s, SLOW_MOTION_DURATION + 0.5).state;
    expect(s.active).toBe(false);
    expect(s.remaining).toBeLessThanOrEqual(0);
  });

  it('sets cooldown on deactivation', () => {
    let s = createNearMissState();
    s = checkNearMiss(s, 0.8).newState;
    s = tickNearMiss(s, SLOW_MOTION_DURATION + 0.5).state;
    expect(s.cooldown).toBeCloseTo(SLOW_MOTION_COOLDOWN, 5);
  });

  it('decays streak after STREAK_WINDOW', () => {
    let s = createNearMissState();
    s.currentStreak = 3;
    s.timeSinceLastMiss = 0;
    s = tickNearMiss(s, STREAK_WINDOW + 0.1).state;
    expect(s.currentStreak).toBe(0);
  });

  it('preserves streak within STREAK_WINDOW', () => {
    let s = createNearMissState();
    s.currentStreak = 3;
    s.timeSinceLastMiss = STREAK_WINDOW - 0.1;
    s = tickNearMiss(s, 0.05).state;
    expect(s.currentStreak).toBe(3);
  });
});

describe('getNearMissComboBonus', () => {
  it('returns base bonus for streak 1', () => {
    expect(getNearMissComboBonus(1)).toBeCloseTo(NEAR_MISS_COMBO_BONUS, 5);
  });

  it('increases with streak', () => {
    expect(getNearMissComboBonus(3)).toBeGreaterThan(getNearMissComboBonus(1));
    expect(getNearMissComboBonus(5)).toBeGreaterThan(getNearMissComboBonus(3));
  });

  it('caps streak bonus at 5', () => {
    expect(getNearMissComboBonus(10)).toBeCloseTo(getNearMissComboBonus(6), 5);
  });
});

describe('getEnemyTimeScale', () => {
  it('returns 1 when both are normal', () => {
    expect(getEnemyTimeScale(1, 1)).toBe(1);
  });

  it('multiplies near-miss slow-mo', () => {
    expect(getEnemyTimeScale(1, SLOW_MOTION_SCALE)).toBeCloseTo(SLOW_MOTION_SCALE, 5);
  });

  it('composes with overdrive', () => {
    const combined = getEnemyTimeScale(0.5, SLOW_MOTION_SCALE);
    expect(combined).toBeCloseTo(0.5 * SLOW_MOTION_SCALE, 5);
  });
});
