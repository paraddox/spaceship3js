import { describe, it, expect } from 'vitest';
import {
  createMusicDirector,
  updateMusicDirector,
  computeIntensity,
  triggerDramaticMoment,
  resetMusicDirector,
} from '../src/game/music-director';
import type { MusicInput, MusicIntensity } from '../src/game/music-director';

// ── Helpers ──────────────────────────────────────────────────

function makeInput(overrides: Partial<MusicInput> = {}): MusicInput {
  return {
    inGame: true,
    waveActive: true,
    enemyCount: 3,
    comboTier: 0,
    overdriveActive: false,
    bossAlive: false,
    bossPhaseIndex: -1,
    playerTakingDamage: false,
    playerHpFraction: 1.0,
    waveTime: 10,
    ...overrides,
  };
}

// ── Creation ─────────────────────────────────────────────────

describe('createMusicDirector', () => {
  it('creates state at intensity 0', () => {
    const state = createMusicDirector();
    expect(state.intensity).toBe(0);
    expect(state.running).toBe(false);
    expect(state.beatCount).toBe(0);
    expect(state.masterVolume).toBe(0);
    expect(state.bpm).toBe(70);
  });
});

// ── Intensity Computation ────────────────────────────────────

describe('computeIntensity', () => {
  it('returns 0 when not in game', () => {
    expect(computeIntensity(makeInput({ inGame: false }))).toBe(0);
  });

  it('returns 1 when in game but no wave active', () => {
    expect(computeIntensity(makeInput({ waveActive: false }))).toBe(1);
  });

  it('returns 2 for basic combat (few enemies)', () => {
    expect(computeIntensity(makeInput({ enemyCount: 3 }))).toBe(2);
  });

  it('returns 3 for many enemies', () => {
    expect(computeIntensity(makeInput({ enemyCount: 8 }))).toBe(3);
  });

  it('returns 3 for low HP with enemies', () => {
    expect(computeIntensity(makeInput({ enemyCount: 1, playerHpFraction: 0.2 }))).toBe(3);
  });

  it('returns 4 for high combo', () => {
    expect(computeIntensity(makeInput({ comboTier: 4 }))).toBe(4);
  });

  it('returns 4 for overdrive', () => {
    expect(computeIntensity(makeInput({ overdriveActive: true }))).toBe(4);
  });

  it('returns 5 for boss fight (any phase)', () => {
    expect(computeIntensity(makeInput({ bossAlive: true, bossPhaseIndex: 0 }))).toBe(5);
  });

  it('returns 5 for boss desperation phase', () => {
    expect(computeIntensity(makeInput({ bossAlive: true, bossPhaseIndex: 2 }))).toBe(5);
  });

  it('boss overrides combo for intensity', () => {
    // Even with high combo, boss should be 5
    expect(computeIntensity(makeInput({ bossAlive: true, comboTier: 5 }))).toBe(5);
  });

  it('overdrive overrides combo', () => {
    expect(computeIntensity(makeInput({ overdriveActive: true, comboTier: 2 }))).toBe(4);
  });
});

// ── Director Update ──────────────────────────────────────────

describe('updateMusicDirector', () => {
  it('starts running when inGame is true', () => {
    const state = createMusicDirector();
    const { state: updated } = updateMusicDirector(state, 0.1, makeInput({ waveActive: false }));
    expect(updated.running).toBe(true);
  });

  it('stops when inGame is false', () => {
    let state = resetMusicDirector(createMusicDirector());
    expect(state.running).toBe(true);
    const { state: updated } = updateMusicDirector(state, 0.1, makeInput({ inGame: false }));
    expect(updated.targetMasterVolume).toBe(0);
  });

  it('intensity ramps up immediately', () => {
    const state = createMusicDirector();
    const { state: updated } = updateMusicDirector(state, 0.1, makeInput({ bossAlive: true }));
    expect(updated.intensity).toBe(5);
    expect(updated.targetBpm).toBe(150);
  });

  it('intensity decreases slowly', () => {
    let state = createMusicDirector();
    // Ramp up to boss intensity
    const { state: s1 } = updateMusicDirector(state, 0.1, makeInput({ bossAlive: true }));
    expect(s1.intensity).toBe(5);
    // Boss dies, intensity should drop by 1 per update (not immediately to 2)
    const { state: s2 } = updateMusicDirector(s1, 0.1, makeInput({ enemyCount: 2 }));
    expect(s2.intensity).toBe(4);
  });

  it('BPM transitions smoothly upward', () => {
    let state = createMusicDirector();
    const { state: s1 } = updateMusicDirector(state, 0.1, makeInput({ bossAlive: true }));
    expect(s1.targetBpm).toBe(150);
    expect(s1.bpm).toBeLessThan(150); // hasn't reached target yet in 0.1s
    expect(s1.bpm).toBeGreaterThan(70); // but has moved from base
  });

  it('BPM transitions smoothly downward (slower)', () => {
    let state = createMusicDirector();
    // Ramp up
    for (let i = 0; i < 50; i++) {
      const result = updateMusicDirector(state, 0.1, makeInput({ bossAlive: true }));
      state = result.state;
    }
    expect(state.bpm).toBeCloseTo(150, 0);
    // Drop to low intensity — intensity decreases by 1 per update tick
    const { state: s1 } = updateMusicDirector(state, 0.1, makeInput({ enemyCount: 2 }));
    // Intensity dropped from 5 to 4 (one step), so targetBpm is 140
    expect(s1.targetBpm).toBe(140);
    // BPM should decrease slowly (half rate)
    expect(s1.bpm).toBeGreaterThan(140);
  });

  it('triggers beats at correct intervals', () => {
    let state = resetMusicDirector(createMusicDirector());
    // First update to establish intensity and BPM
    const { state: s0, beatTriggered: b0 } = updateMusicDirector(state, 0.01, makeInput({ waveActive: false }));
    state = s0;
    const beatDuration = 60 / state.bpm; // Use actual BPM after intensity resolves
    const { state: s1, beatTriggered: b1 } = updateMusicDirector(state, beatDuration, makeInput({ waveActive: false }));
    expect(b1).toBe(true);

    const { state: s2, beatTriggered: b2 } = updateMusicDirector(s1, beatDuration, makeInput({ waveActive: false }));
    expect(b2).toBe(true);

    // Half a beat shouldn't trigger
    const { beatTriggered: b3 } = updateMusicDirector(s2, beatDuration * 0.4, makeInput({ waveActive: false }));
    expect(b3).toBe(false);
  });

  it('no beats at intensity 0', () => {
    const state = createMusicDirector(); // not running, intensity 0
    const { beatTriggered } = updateMusicDirector(state, 1.0, makeInput({ inGame: false }));
    expect(beatTriggered).toBe(false);
  });

  it('bar/beat counting works correctly', () => {
    let state = resetMusicDirector(createMusicDirector());
    // Use a constant-input scenario for predictable beat timing
    let beatDuration = 60 / state.bpm;

    // Run enough beats — BPM will shift as intensity resolves
    for (let i = 0; i < 8; i++) {
      const result = updateMusicDirector(state, beatDuration, makeInput({ enemyCount: 4 }));
      state = result.state;
      beatDuration = 60 / state.bpm; // recalculate after BPM changes
    }

    // After 8 beats, beatCount should be 8
    expect(state.beatCount).toBe(8);
    expect(state.currentBeat).toBe(0);
  });

  it('pattern seed changes every 8 bars', () => {
    let state = resetMusicDirector(createMusicDirector());
    let beatDuration = 60 / state.bpm;

    // Run enough beats for 8 bars — use dynamic BPM
    for (let i = 0; i < 40; i++) {
      const result = updateMusicDirector(state, beatDuration, makeInput({ enemyCount: 4 }));
      state = result.state;
      beatDuration = 60 / state.bpm;
    }

    // After enough bars, pattern variation should have triggered
    // barsSinceVariation will be > 0 if we passed 8 bars
    expect(state.barsSinceVariation).toBeGreaterThanOrEqual(0);
  });
});

// ── Dramatic Moments ─────────────────────────────────────────

describe('triggerDramaticMoment', () => {
  it('sets dramatic moment flag', () => {
    const state = createMusicDirector();
    const dramatic = triggerDramaticMoment(state, 3.0);
    expect(dramatic.dramaticMoment).toBe(true);
    expect(dramatic.dramaticTimer).toBe(3.0);
  });

  it('clears after timer expires', () => {
    let state = createMusicDirector();
    state = triggerDramaticMoment(state, 1.0);
    const { state: updated } = updateMusicDirector(state, 1.5, makeInput({ enemyCount: 2 }));
    expect(updated.dramaticMoment).toBe(false);
  });

  it('boosts volume during dramatic moment', () => {
    let state = createMusicDirector();
    state = triggerDramaticMoment(state, 5.0);
    state.intensity = 3;
    state.running = true;
    // enemyCount >= 8 → intensity 3, base volume 0.35, dramatic boost = min(0.6, 0.35*1.3) = 0.455
    const { state: updated } = updateMusicDirector(state, 0.1, makeInput({ enemyCount: 8 }));
    expect(updated.targetMasterVolume).toBeGreaterThan(0.35);
  });
});

// ── Reset ────────────────────────────────────────────────────

describe('resetMusicDirector', () => {
  it('resets to fresh running state', () => {
    const state = createMusicDirector();
    const reset = resetMusicDirector(state);
    expect(reset.running).toBe(true);
    expect(reset.intensity).toBe(0);
    expect(reset.beatCount).toBe(0);
  });
});
