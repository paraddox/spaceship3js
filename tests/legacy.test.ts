import { describe, it, expect } from 'vitest';
import {
  computeLegacyXp,
  computeLegacyLevel,
  getLegacyRank,
  finalizeRun,
  canActivateBonus,
  toggleActiveBonus,
  getActiveBonusEffects,
  getCreditPercentBoost,
  isMilestoneCompleted,
  getMilestoneProgress,
  getLegacySummary,
  MILESTONES,
  STARTING_BONUSES,
  DEFAULT_LEGACY_STATE,
  MAX_ACTIVE_BONUSES,
} from '../src/game/legacy';
import type { RunSnapshot, LegacyState, StartingBonusId } from '../src/game/legacy';

// ── Helpers ──────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    waveReached: 1,
    totalKills: 5,
    eliteKills: 0,
    bossKills: 0,
    score: 500,
    creditsEarned: 100,
    timeSeconds: 60,
    bestCombo: 3,
    highestComboTier: 'Rampage',
    damageDealt: 2000,
    damageTaken: 500,
    pickupsCollected: 2,
    hpRemaining: 80,
    maxHp: 100,
    mutatorsChosen: [],
    upgradesPurchased: [],
    overdriveActivations: 0,
    dashCount: 1,
    abilityActivations: 0,
    grade: 'C',
    ...overrides,
  };
}

function makeLegacy(overrides: Partial<LegacyState> = {}): LegacyState {
  return {
    ...DEFAULT_LEGACY_STATE,
    ...overrides,
  };
}

// ── XP Calculation ───────────────────────────────────────────

describe('computeLegacyXp', () => {
  it('returns at least 5 XP (base) for any run', () => {
    const snap = makeSnapshot({ waveReached: 0, totalKills: 0, score: 0, grade: 'D' });
    expect(computeLegacyXp(snap)).toBeGreaterThanOrEqual(5);
  });

  it('adds 3 XP per wave reached', () => {
    const base = computeLegacyXp(makeSnapshot({ waveReached: 0, totalKills: 0, score: 0, grade: 'D' }));
    const w5 = computeLegacyXp(makeSnapshot({ waveReached: 5, totalKills: 0, score: 0, grade: 'D' }));
    expect(w5).toBe(base + 15);
  });

  it('adds 0.5 XP per kill (floored)', () => {
    const base = computeLegacyXp(makeSnapshot({ totalKills: 0, grade: 'D' }));
    const k10 = computeLegacyXp(makeSnapshot({ totalKills: 10, grade: 'D' }));
    expect(k10).toBe(base + 5); // 10 * 0.5 = 5
  });

  it('adds 1 XP per 200 score', () => {
    const base = computeLegacyXp(makeSnapshot({ score: 0, grade: 'D' }));
    const s600 = computeLegacyXp(makeSnapshot({ score: 600, grade: 'D' }));
    expect(s600).toBe(base + 3);
  });

  it('gives bonus XP for high combos', () => {
    const noCombo = computeLegacyXp(makeSnapshot({ bestCombo: 0, grade: 'D' }));
    const combo5 = computeLegacyXp(makeSnapshot({ bestCombo: 5, grade: 'D' }));
    const combo10 = computeLegacyXp(makeSnapshot({ bestCombo: 10, grade: 'D' }));
    const combo20 = computeLegacyXp(makeSnapshot({ bestCombo: 20, grade: 'D' }));
    expect(combo5).toBe(noCombo + 5);
    expect(combo10).toBe(combo5 + 10);
    expect(combo20).toBe(combo10 + 15);
  });

  it('gives grade bonus XP', () => {
    const d = computeLegacyXp(makeSnapshot({ grade: 'D', bestCombo: 0, score: 0, totalKills: 0, waveReached: 0 }));
    const c = computeLegacyXp(makeSnapshot({ grade: 'C', bestCombo: 0, score: 0, totalKills: 0, waveReached: 0 }));
    const b = computeLegacyXp(makeSnapshot({ grade: 'B', bestCombo: 0, score: 0, totalKills: 0, waveReached: 0 }));
    const a = computeLegacyXp(makeSnapshot({ grade: 'A', bestCombo: 0, score: 0, totalKills: 0, waveReached: 0 }));
    const s = computeLegacyXp(makeSnapshot({ grade: 'S', bestCombo: 0, score: 0, totalKills: 0, waveReached: 0 }));
    expect(c).toBe(d + 5);
    expect(b).toBe(c + 5);
    expect(a).toBe(b + 10);
    expect(s).toBe(a + 10);
  });

  it('gives survival bonus XP', () => {
    const short = computeLegacyXp(makeSnapshot({ timeSeconds: 60, grade: 'D' }));
    const med = computeLegacyXp(makeSnapshot({ timeSeconds: 200, grade: 'D' }));
    const long = computeLegacyXp(makeSnapshot({ timeSeconds: 400, grade: 'D' }));
    const longest = computeLegacyXp(makeSnapshot({ timeSeconds: 700, grade: 'D' }));
    expect(med).toBe(short + 5);   // 200 >= 120
    expect(long).toBe(med + 10);   // 400 >= 300 (adds +10 more)
    expect(longest).toBe(long + 15); // 700 >= 600 (adds +15 more)
  });
});

// ── Level System ─────────────────────────────────────────────

describe('computeLegacyLevel', () => {
  it('level 0 at 0 XP', () => {
    const result = computeLegacyLevel(0);
    expect(result.level).toBe(0);
  });

  it('level 1 at 25 XP', () => {
    const result = computeLegacyLevel(25);
    expect(result.level).toBe(1);
    expect(result.currentXp).toBe(0);
  });

  it('level 2 at 75 XP (25 + 50)', () => {
    const result = computeLegacyLevel(75);
    expect(result.level).toBe(2);
  });

  it('tracks partial XP correctly', () => {
    const result = computeLegacyLevel(50);
    expect(result.level).toBe(1);
    expect(result.currentXp).toBe(25);
    expect(result.xpForNext).toBe(50);
  });
});

describe('getLegacyRank', () => {
  it('returns Recruit for level 0', () => {
    expect(getLegacyRank(0).name).toBe('Recruit');
  });

  it('returns Cadet for level 1', () => {
    expect(getLegacyRank(1).name).toBe('Cadet');
  });

  it('returns Pilot for level 3', () => {
    expect(getLegacyRank(3).name).toBe('Pilot');
  });

  it('returns Commander for level 10', () => {
    expect(getLegacyRank(10).name).toBe('Commander');
  });

  it('returns Captain for level 15', () => {
    expect(getLegacyRank(15).name).toBe('Captain');
  });

  it('returns Admiral for level 20', () => {
    expect(getLegacyRank(20).name).toBe('Admiral');
  });
});

// ── Run Finalization ─────────────────────────────────────────

describe('finalizeRun', () => {
  it('increments totalRuns', () => {
    const legacy = makeLegacy();
    const snap = makeSnapshot();
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.totalRuns).toBe(1);
  });

  it('adds XP to totalXp', () => {
    const legacy = makeLegacy();
    const snap = makeSnapshot();
    const expectedXp = computeLegacyXp(snap);
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.totalXp).toBe(expectedXp);
  });

  it('updates bestWave', () => {
    const legacy = makeLegacy({ bestWave: 3 });
    const snap = makeSnapshot({ waveReached: 7 });
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.bestWave).toBe(7);
  });

  it('does not decrease bestWave', () => {
    const legacy = makeLegacy({ bestWave: 10 });
    const snap = makeSnapshot({ waveReached: 3 });
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.bestWave).toBe(10);
  });

  it('updates bestGrade', () => {
    const legacy = makeLegacy({ bestGrade: 'C' });
    const snap = makeSnapshot({ grade: 'A' });
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.bestGrade).toBe('A');
  });

  it('does not downgrade bestGrade', () => {
    const legacy = makeLegacy({ bestGrade: 'S' });
    const snap = makeSnapshot({ grade: 'B' });
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.bestGrade).toBe('S');
  });

  it('accumulates totalKills across runs', () => {
    const legacy = makeLegacy({ totalKills: 50 });
    const snap = makeSnapshot({ totalKills: 20 });
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.totalKills).toBe(70);
  });

  it('detects first_blood milestone', () => {
    const legacy = makeLegacy();
    const snap = makeSnapshot({ totalKills: 1 });
    const { newMilestones } = finalizeRun(legacy, snap);
    expect(newMilestones.some((m) => m.id === 'first_blood')).toBe(true);
  });

  it('does not re-detect completed milestones', () => {
    const legacy = makeLegacy({
      completedMilestones: [{ milestoneId: 'first_blood', completedAt: 1, runNumber: 1 }],
    });
    const snap = makeSnapshot({ totalKills: 5 });
    const { newMilestones } = finalizeRun(legacy, snap);
    expect(newMilestones.some((m) => m.id === 'first_blood')).toBe(false);
  });

  it('unlocks bonus associated with milestone', () => {
    const legacy = makeLegacy();
    const snap = makeSnapshot({ totalKills: 1 });
    const { updated } = finalizeRun(legacy, snap);
    // first_blood unlocks 'quick_start'
    expect(updated.unlockedBonuses).toContain('quick_start');
  });

  it('auto-activates first bonus when none active', () => {
    const legacy = makeLegacy();
    const snap = makeSnapshot({ totalKills: 1 });
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.activeBonuses.length).toBe(1);
    expect(updated.activeBonuses[0]).toBe('quick_start');
  });

  it('does not auto-activate when bonuses already active', () => {
    const legacy = makeLegacy({ activeBonuses: ['tough_hull'], unlockedBonuses: ['tough_hull'] });
    const snap = makeSnapshot({ totalKills: 1 });
    const { updated } = finalizeRun(legacy, snap);
    expect(updated.activeBonuses).toEqual(['tough_hull']);
  });

  it('idempotent — calling twice with same snapshot does not double-count', () => {
    const legacy = makeLegacy();
    const snap = makeSnapshot({ totalKills: 5 });
    const { updated: u1 } = finalizeRun(legacy, snap);
    const { updated: u2 } = finalizeRun(u1, snap);
    // u2 should have 2 runs but not double-XP the second time
    expect(u2.totalRuns).toBe(2);
    expect(u2.totalKills).toBe(10); // 5 per run
  });
});

// ── Bonus Management ─────────────────────────────────────────

describe('canActivateBonus', () => {
  it('returns false if bonus not unlocked', () => {
    const legacy = makeLegacy();
    expect(canActivateBonus(legacy, 'tough_hull')).toBe(false);
  });

  it('returns true if unlocked and slots available', () => {
    const legacy = makeLegacy({ unlockedBonuses: ['tough_hull'], activeBonuses: [] });
    expect(canActivateBonus(legacy, 'tough_hull')).toBe(true);
  });

  it('returns false if already active', () => {
    const legacy = makeLegacy({ unlockedBonuses: ['tough_hull'], activeBonuses: ['tough_hull'] });
    expect(canActivateBonus(legacy, 'tough_hull')).toBe(false);
  });

  it('returns false if at max capacity', () => {
    const legacy = makeLegacy({
      unlockedBonuses: ['tough_hull', 'quick_start', 'credit_booster', 'shield_seed'],
      activeBonuses: ['tough_hull', 'quick_start', 'credit_booster'],
    });
    expect(canActivateBonus(legacy, 'shield_seed')).toBe(false);
  });

  it('returns true if one slot remaining', () => {
    const legacy = makeLegacy({
      unlockedBonuses: ['tough_hull', 'quick_start', 'credit_booster'],
      activeBonuses: ['tough_hull', 'quick_start'],
    });
    expect(canActivateBonus(legacy, 'credit_booster')).toBe(true);
  });
});

describe('toggleActiveBonus', () => {
  it('deactivates an active bonus', () => {
    const legacy = makeLegacy({ activeBonuses: ['tough_hull', 'quick_start'] });
    const result = toggleActiveBonus(legacy, 'tough_hull');
    expect(result.activeBonuses).toEqual(['quick_start']);
  });

  it('activates an available bonus', () => {
    const legacy = makeLegacy({ unlockedBonuses: ['tough_hull', 'quick_start'], activeBonuses: ['tough_hull'] });
    const result = toggleActiveBonus(legacy, 'quick_start');
    expect(result.activeBonuses).toEqual(['tough_hull', 'quick_start']);
  });

  it('returns unchanged if cannot activate', () => {
    const legacy = makeLegacy({ unlockedBonuses: [], activeBonuses: [] });
    const result = toggleActiveBonus(legacy, 'tough_hull');
    expect(result.activeBonuses).toEqual([]);
  });
});

describe('getActiveBonusEffects', () => {
  it('returns effects for active bonuses', () => {
    const legacy = makeLegacy({
      unlockedBonuses: ['tough_hull', 'credit_booster'],
      activeBonuses: ['tough_hull', 'credit_booster'],
    });
    const effects = getActiveBonusEffects(legacy);
    expect(effects.length).toBe(2);
    expect(effects[0].kind).toBe('bonus_hp');
    expect(effects[1].kind).toBe('credit_percent');
  });

  it('returns empty for no active bonuses', () => {
    const effects = getActiveBonusEffects(makeLegacy());
    expect(effects).toEqual([]);
  });
});

describe('getCreditPercentBoost', () => {
  it('returns 0 when no credit_percent bonus active', () => {
    expect(getCreditPercentBoost(makeLegacy())).toBe(0);
  });

  it('returns the bonus value', () => {
    const legacy = makeLegacy({
      unlockedBonuses: ['credit_booster'],
      activeBonuses: ['credit_booster'],
    });
    expect(getCreditPercentBoost(legacy)).toBe(10);
  });
});

// ── Query Helpers ────────────────────────────────────────────

describe('isMilestoneCompleted', () => {
  it('returns false when not completed', () => {
    expect(isMilestoneCompleted(makeLegacy(), 'first_blood')).toBe(false);
  });

  it('returns true when completed', () => {
    const legacy = makeLegacy({
      completedMilestones: [{ milestoneId: 'first_blood', completedAt: 1, runNumber: 1 }],
    });
    expect(isMilestoneCompleted(legacy, 'first_blood')).toBe(true);
  });
});

describe('getMilestoneProgress', () => {
  it('returns correct totals', () => {
    const progress = getMilestoneProgress(makeLegacy());
    expect(progress.total).toBe(MILESTONES.length);
    expect(progress.completed).toBe(0);
  });

  it('counts completed milestones', () => {
    const legacy = makeLegacy({
      completedMilestones: [
        { milestoneId: 'first_blood', completedAt: 1, runNumber: 1 },
        { milestoneId: 'wave_5', completedAt: 2, runNumber: 2 },
      ],
    });
    const progress = getMilestoneProgress(legacy);
    expect(progress.completed).toBe(2);
  });

  it('tracks by-category progress', () => {
    const progress = getMilestoneProgress(makeLegacy());
    expect(progress.byCategory).toHaveProperty('combat');
    expect(progress.byCategory).toHaveProperty('survival');
    expect(progress.byCategory).toHaveProperty('economy');
    expect(progress.byCategory).toHaveProperty('mastery');
  });
});

describe('getLegacySummary', () => {
  it('returns full summary with all fields', () => {
    const legacy = makeLegacy({ totalXp: 100, totalRuns: 3, bestWave: 7, totalKills: 50 });
    const summary = getLegacySummary(legacy);
    expect(summary.level).toBeGreaterThan(0);
    expect(summary.totalRuns).toBe(3);
    expect(summary.bestWave).toBe(7);
    expect(summary.totalKills).toBe(50);
    expect(summary.milestonesTotal).toBe(MILESTONES.length);
    expect(summary.rank.name).toBeDefined();
    expect(summary.rank.icon).toBeDefined();
  });
});

// ── Milestone Catalog Integrity ─────────────────────────────

describe('Milestone catalog', () => {
  it('all milestones reference valid bonuses', () => {
    const bonusIds = new Set(STARTING_BONUSES.map((b) => b.id));
    for (const milestone of MILESTONES) {
      expect(bonusIds.has(milestone.unlocks), `${milestone.id} references unknown bonus ${milestone.unlocks}`).toBe(true);
    }
  });

  it('all milestone IDs are unique', () => {
    const ids = MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('milestone categories are consistent', () => {
    const validCategories = new Set(['combat', 'survival', 'economy', 'mastery']);
    for (const milestone of MILESTONES) {
      expect(validCategories.has(milestone.category)).toBe(true);
    }
  });
});
