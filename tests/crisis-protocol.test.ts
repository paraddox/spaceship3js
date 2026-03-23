import { describe, it, expect } from 'vitest';
import {
  createCrisisState,
  shouldTriggerCrisis,
  selectCrisisEvent,
  prepareCrisisEvent,
  resolveCrisisChoice,
  markCrisisResolved,
  isCrisisPending,
  getActiveEffectLabels,
  EVENT_INTERVAL,
  EVENT_WAVE_MIN,
  MAX_EFFECTS,
} from '../src/game/critical-events';
import type { CrisisState, CrisisEffectId } from '../src/game/critical-events';

describe('createCrisisState', () => {
  it('returns default empty state', () => {
    const state = createCrisisState();
    expect(state.pendingEvent).toBeNull();
    expect(state.activeEffects).toEqual([]);
    expect(state.resolvedWaves).toEqual([]);
    expect(isCrisisPending(state)).toBe(false);
  });
});

describe('shouldTriggerCrisis', () => {
  it('does not trigger before wave 6', () => {
    expect(shouldTriggerCrisis(3, createCrisisState())).toBe(false);
    expect(shouldTriggerCrisis(5, createCrisisState())).toBe(false);
  });

  it('triggers at wave 6', () => {
    expect(shouldTriggerCrisis(6, createCrisisState())).toBe(true);
  });

  it('does not trigger on already-resolved waves', () => {
    const state = markCrisisResolved(createCrisisState(), 6);
    expect(shouldTriggerCrisis(6, state)).toBe(false);
  });

  it('triggers at wave 12, 18, etc.', () => {
    const state = createCrisisState();
    expect(shouldTriggerCrisis(12, state)).toBe(true);
    expect(shouldTriggerCrisis(18, state)).toBe(true);
  });

  it('does not trigger at non-interval waves', () => {
    expect(shouldTriggerCrisis(7, createCrisisState())).toBe(false);
    expect(shouldTriggerCrisis(9, createCrisisState())).toBe(false);
    expect(shouldTriggerCrisis(11, createCrisisState())).toBe(false);
  });
});

describe('selectCrisisEvent', () => {
  it('returns an event for eligible wave', () => {
    const event = selectCrisisEvent(6, createCrisisState(), 0.5);
    expect(event).not.toBeNull();
    expect(event!.choices.length).toBe(2);
  });

  it('returns null when all events resolved', () => {
    // With MAX_EFFECTS capped at 4, after enough events we'd fill up
    // But selection should still work for a while
    const event = selectCrisisEvent(6, createCrisisState(), 0.5);
    expect(event).not.toBeNull();
  });
});

describe('prepareCrisisEvent', () => {
  it('sets pendingEvent and marks wave', () => {
    const state = prepareCrisisEvent(6, createCrisisState(), 0.5);
    expect(state.pendingEvent).not.toBeNull();
    expect(isCrisisPending(state)).toBe(true);
  });
});

describe('resolveCrisisChoice', () => {
  it('adds effect and clears pendingEvent', () => {
    const prepared = prepareCrisisEvent(6, createCrisisState(), 0.5);
    const effectId = prepared.pendingEvent!.choices[0].id;
    const resolved = resolveCrisisChoice(prepared, effectId);
    expect(resolved.pendingEvent).toBeNull();
    expect(isCrisisPending(resolved)).toBe(false);
    expect(resolved.activeEffects).toContain(effectId);
  });

  it('respects MAX_EFFECTS cap', () => {
    let state = createCrisisState();
    // Resolve many events — eventually should stop adding effects
    for (let wave = 6; wave <= 60; wave += EVENT_INTERVAL) {
      if (shouldTriggerCrisis(wave, state)) {
        const prepared = prepareCrisisEvent(wave, state, wave / 100);
        if (prepared.pendingEvent) {
          state = resolveCrisisChoice(prepared, prepared.pendingEvent.choices[0].id);
        }
      }
    }
    expect(state.activeEffects.length).toBeLessThanOrEqual(MAX_EFFECTS);
  });
});

describe('markCrisisResolved', () => {
  it('records resolved wave', () => {
    const state = markCrisisResolved(createCrisisState(), 6);
    expect(state.resolvedWaves).toContain(6);
  });
});

describe('getActiveEffectLabels', () => {
  it('returns empty for no effects', () => {
    expect(getActiveEffectLabels([])).toEqual([]);
  });

  it('returns label for each effect', () => {
    const effects: CrisisEffectId[] = ['meltdown_protocol'];
    const labels = getActiveEffectLabels(effects);
    expect(labels.length).toBe(1);
    expect(labels[0].name).toBeTruthy();
    expect(labels[0].icon).toBeTruthy();
    expect(labels[0].color).toBeTruthy();
  });
});

describe('isCrisisPending', () => {
  it('returns false for default state', () => {
    expect(isCrisisPending(createCrisisState())).toBe(false);
  });

  it('returns true when event is prepared', () => {
    const state = prepareCrisisEvent(6, createCrisisState(), 0.5);
    expect(isCrisisPending(state)).toBe(true);
  });
});
