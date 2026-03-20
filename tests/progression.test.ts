import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROGRESSION_STATE,
  applyEncounterReward,
  createEncounterReward,
  markEncounterCompleted,
  type ProgressionState,
} from '../src/game/progression';

describe('progression helpers', () => {
  it('starts with a stable default progression state', () => {
    expect(DEFAULT_PROGRESSION_STATE).toEqual({
      credits: 0,
      completedEncounterIds: [],
      bestEncounterScores: {},
    });
  });

  it('creates larger rewards for harder encounters', () => {
    const easy = createEncounterReward(1, 1, true);
    const hard = createEncounterReward(3, 2, true);
    expect(hard.credits).toBeGreaterThan(easy.credits);
  });

  it('applies reward credits and records best score', () => {
    const state: ProgressionState = {
      credits: 50,
      completedEncounterIds: [],
      bestEncounterScores: {},
    };
    const next = applyEncounterReward(state, 'gauntlet', { credits: 120, score: 1800, victory: true });
    expect(next.credits).toBe(170);
    expect(next.bestEncounterScores.gauntlet).toBe(1800);
    expect(next.completedEncounterIds).toContain('gauntlet');
  });

  it('does not lower an existing best score', () => {
    const state: ProgressionState = {
      credits: 0,
      completedEncounterIds: ['gauntlet'],
      bestEncounterScores: { gauntlet: 2400 },
    };
    const next = applyEncounterReward(state, 'gauntlet', { credits: 50, score: 1200, victory: true });
    expect(next.bestEncounterScores.gauntlet).toBe(2400);
  });

  it('tracks completion without duplicate entries', () => {
    const once = markEncounterCompleted(DEFAULT_PROGRESSION_STATE, 'duel');
    const twice = markEncounterCompleted(once, 'duel');
    expect(twice.completedEncounterIds).toEqual(['duel']);
  });
});
