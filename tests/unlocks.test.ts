import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UNLOCKED_MODULE_IDS,
  MODULE_UNLOCK_COSTS,
  canUnlockModule,
  unlockModule,
  isModuleUnlocked,
} from '../src/game/unlocks';
import type { ProgressionState } from '../src/game/progression';

describe('module unlock progression', () => {
  it('starts with a stable set of starter modules unlocked', () => {
    expect(DEFAULT_UNLOCKED_MODULE_IDS).toContain('core:bridge_scout');
    expect(DEFAULT_UNLOCKED_MODULE_IDS).toContain('core:hull_1x1');
    expect(DEFAULT_UNLOCKED_MODULE_IDS).not.toContain('core:missile_launcher');
  });

  it('exposes non-zero costs for advanced modules', () => {
    expect(MODULE_UNLOCK_COSTS['core:missile_launcher']).toBeGreaterThan(0);
    expect(MODULE_UNLOCK_COSTS['core:light_drone_bay']).toBeGreaterThan(0);
  });

  it('knows whether a module is unlocked from progression state', () => {
    const state: ProgressionState = {
      credits: 0,
      completedEncounterIds: [],
      bestEncounterScores: {},
      unlockedModuleIds: ['core:bridge_scout', 'core:hull_1x1'],
    };
    expect(isModuleUnlocked(state, 'core:hull_1x1')).toBe(true);
    expect(isModuleUnlocked(state, 'core:missile_launcher')).toBe(false);
  });

  it('requires enough credits before allowing unlock purchase', () => {
    const poorState: ProgressionState = {
      credits: 40,
      completedEncounterIds: [],
      bestEncounterScores: {},
      unlockedModuleIds: [...DEFAULT_UNLOCKED_MODULE_IDS],
    };
    expect(canUnlockModule(poorState, 'core:missile_launcher')).toBe(false);
  });

  it('spends credits and records a newly unlocked module', () => {
    const richState: ProgressionState = {
      credits: 500,
      completedEncounterIds: [],
      bestEncounterScores: {},
      unlockedModuleIds: [...DEFAULT_UNLOCKED_MODULE_IDS],
    };
    const next = unlockModule(richState, 'core:missile_launcher');
    expect(next.credits).toBe(500 - MODULE_UNLOCK_COSTS['core:missile_launcher']);
    expect(next.unlockedModuleIds).toContain('core:missile_launcher');
  });

  it('does not double-charge for already unlocked modules', () => {
    const state: ProgressionState = {
      credits: 500,
      completedEncounterIds: [],
      bestEncounterScores: {},
      unlockedModuleIds: [...DEFAULT_UNLOCKED_MODULE_IDS, 'core:missile_launcher'],
    };
    const next = unlockModule(state, 'core:missile_launcher');
    expect(next).toEqual(state);
  });
});
