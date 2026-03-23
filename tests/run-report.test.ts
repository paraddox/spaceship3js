import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RUN_STATS,
  computeRunGrade,
  formatTime,
  formatBig,
  getCauseOfDeath,
  getNextRunTip,
  getHighlights,
  RUN_GRADES,
} from '../src/game/run-report';
import type { RunStats } from '../src/game/run-report';

describe('run report card', () => {
  it('RUN_GRADES has S/A/B/C/D', () => {
    expect(RUN_GRADES.map((g) => g.letter)).toEqual(['S', 'A', 'B', 'C', 'D']);
  });

  it('DEFAULT_RUN_STATS has all fields zeroed', () => {
    expect(DEFAULT_RUN_STATS.waveReached).toBe(0);
    expect(DEFAULT_RUN_STATS.totalKills).toBe(0);
    expect(DEFAULT_RUN_STATS.damageDealt).toBe(0);
    expect(DEFAULT_RUN_STATS.damageTaken).toBe(0);
    expect(DEFAULT_RUN_STATS.mutatorsChosen).toEqual([]);
    expect(DEFAULT_RUN_STATS.upgradesPurchased).toEqual([]);
  });

  it('formatTime works', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('formatBig works', () => {
    expect(formatBig(500)).toBe('500');
    expect(formatBig(5000)).toBe('5.0K');
    expect(formatBig(50000)).toBe('50.0K');
    expect(formatBig(5000000)).toBe('5.0M');
  });

  it('getCauseOfDeath returns appropriate messages', () => {
    const dead: RunStats = { ...DEFAULT_RUN_STATS, hpRemaining: 0, maxHp: 100 };
    expect(getCauseOfDeath(dead)).toContain('total structural failure');

    const heavy: RunStats = { ...DEFAULT_RUN_STATS, hpRemaining: 20, maxHp: 100 };
    expect(getCauseOfDeath(heavy)).toContain('overwhelmed');

    const light: RunStats = { ...DEFAULT_RUN_STATS, hpRemaining: 80, maxHp: 100 };
    expect(getCauseOfDeath(light)).toContain('forced retreat');
  });

  it('computeRunGrade returns D for zero stats', () => {
    const grade = computeRunGrade(DEFAULT_RUN_STATS);
    expect(grade.letter).toBe('D');
  });

  it('computeRunGrade returns higher grades for good stats', () => {
    const good: RunStats = {
      ...DEFAULT_RUN_STATS,
      waveReached: 15,
      totalKills: 40,
      bestCombo: 8,
      damageDealt: 5000,
      damageTaken: 1000,
      timeSeconds: 300,
    };
    const grade = computeRunGrade(good);
    expect(['S', 'A', 'B'].includes(grade.letter)).toBe(true);
  });

  it('computeRunGrade returns S for exceptional stats', () => {
    const epic: RunStats = {
      ...DEFAULT_RUN_STATS,
      waveReached: 30,
      totalKills: 80,
      bestCombo: 20,
      damageDealt: 50000,
      damageTaken: 2000,
      timeSeconds: 600,
    };
    const grade = computeRunGrade(epic);
    expect(grade.letter).toBe('S');
  });

  it('getNextRunTip returns non-empty strings', () => {
    for (const grade of RUN_GRADES) {
      const tip = getNextRunTip(grade, DEFAULT_RUN_STATS);
      expect(tip.length).toBeGreaterThan(0);
    }
  });

  it('getHighlights returns empty for no achievements', () => {
    const highlights = getHighlights(DEFAULT_RUN_STATS);
    expect(highlights).toEqual([]);
  });

  it('getHighlights returns achievements for notable runs', () => {
    const run: RunStats = {
      ...DEFAULT_RUN_STATS,
      waveReached: 20,
      totalKills: 50,
      bestCombo: 15,
      eliteKills: 5,
      timeSeconds: 400,
      overdriveActivations: 3,
      mutatorsChosen: ['Vampiric', 'Momentum', 'Last Stand'],
    };
    const highlights = getHighlights(run);
    expect(highlights.length).toBeGreaterThanOrEqual(2);
  });

  it('getHighlights caps at 3', () => {
    const run: RunStats = {
      ...DEFAULT_RUN_STATS,
      waveReached: 25,
      totalKills: 60,
      bestCombo: 22,
      eliteKills: 10,
      bossKills: 4,
      damageDealt: 50000,
      damageTaken: 100,
      timeSeconds: 600,
      overdriveActivations: 5,
      mutatorsChosen: ['A', 'B', 'C'],
    };
    const highlights = getHighlights(run);
    expect(highlights.length).toBeLessThanOrEqual(3);
  });
});
