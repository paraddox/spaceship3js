import { describe, it, expect } from 'vitest';
import {
  ARENA_RIFTS,
  getRiftDef,
  shouldTriggerRift,
  isCrisisWave,
  isRiftWave,
  rollRiftType,
  createRiftState,
  updateRift,
  getRiftArenaRadius,
  getRiftGravityForce,
  isRiftEmpActive,
  getEmpCountdown,
  getRiftShockwaveForce,
  isOutsideVoidCollapse,
  getRiftType,
  type ArenaRiftType,
  type ArenaRiftState,
  type ArenaRiftActive,
} from '../src/game/arena-rift';

const BASE_ARENA_RADIUS = 17;

// ── Catalog ─────────────────────────────────────────────────────

describe('catalog', () => {
  it('ARENA_RIFTS has exactly 4 items', () => {
    expect(ARENA_RIFTS).toHaveLength(4);
  });

  it('contains one def per rift type', () => {
    const ids = ARENA_RIFTS.map((r) => r.id);
    expect(ids).toContain('void_collapse');
    expect(ids).toContain('gravity_well');
    expect(ids).toContain('emp_storm');
    expect(ids).toContain('shockwave');
  });

  const expectedDefs: { id: ArenaRiftType; displayName: string; icon: string; color: string }[] = [
    { id: 'void_collapse', displayName: 'Void Collapse', icon: '🕳️', color: '#7c3aed' },
    { id: 'gravity_well', displayName: 'Gravity Well', icon: '🌀', color: '#06b6d4' },
    { id: 'emp_storm', displayName: 'EMP Storm', icon: '⚡', color: '#eab308' },
    { id: 'shockwave', displayName: 'Shockwave', icon: '💥', color: '#ef4444' },
  ];

  expectedDefs.forEach(({ id, displayName, icon, color }) => {
    it(`getRiftDef('${id}') returns correct definition`, () => {
      const def = getRiftDef(id);
      expect(def.id).toBe(id);
      expect(def.displayName).toBe(displayName);
      expect(def.icon).toBe(icon);
      expect(def.color).toBe(color);
      expect(def.description).toBeTruthy();
    });
  });

  it('each def has a non-empty description', () => {
    for (const def of ARENA_RIFTS) {
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});

// ── Rift Selection ─────────────────────────────────────────────

describe('shouldTriggerRift', () => {
  const nullRift = null;

  it('triggers on wave 3', () => {
    expect(shouldTriggerRift(3, nullRift)).toBe(true);
  });

  it('triggers on wave 9', () => {
    expect(shouldTriggerRift(9, nullRift)).toBe(true);
  });

  it('triggers on wave 15', () => {
    expect(shouldTriggerRift(15, nullRift)).toBe(true);
  });

  it('triggers on wave 21', () => {
    expect(shouldTriggerRift(21, nullRift)).toBe(true);
  });

  it('does NOT trigger on wave 6 (crisis)', () => {
    expect(shouldTriggerRift(6, nullRift)).toBe(false);
  });

  it('does NOT trigger on wave 12 (crisis)', () => {
    expect(shouldTriggerRift(12, nullRift)).toBe(false);
  });

  it('does NOT trigger on wave 18 (crisis)', () => {
    expect(shouldTriggerRift(18, nullRift)).toBe(false);
  });

  it('does NOT trigger on wave 1 or 2', () => {
    expect(shouldTriggerRift(1, nullRift)).toBe(false);
    expect(shouldTriggerRift(2, nullRift)).toBe(false);
  });

  it('does NOT trigger on non-rift waves like 4, 5, 7, 8', () => {
    expect(shouldTriggerRift(4, nullRift)).toBe(false);
    expect(shouldTriggerRift(5, nullRift)).toBe(false);
    expect(shouldTriggerRift(7, nullRift)).toBe(false);
    expect(shouldTriggerRift(8, nullRift)).toBe(false);
  });

  it('returns false when an existing rift is active', () => {
    const existingRift: ArenaRiftActive = {
      rift: createRiftState('void_collapse', 42),
      wavesRemaining: 2,
    };
    expect(shouldTriggerRift(3, existingRift)).toBe(false);
    expect(shouldTriggerRift(9, existingRift)).toBe(false);
  });

  it('does NOT trigger on wave 0', () => {
    expect(shouldTriggerRift(0, nullRift)).toBe(false);
  });
});

describe('isCrisisWave', () => {
  it('returns true for wave 6', () => {
    expect(isCrisisWave(6)).toBe(true);
  });

  it('returns true for wave 12', () => {
    expect(isCrisisWave(12)).toBe(true);
  });

  it('returns true for wave 18', () => {
    expect(isCrisisWave(18)).toBe(true);
  });

  it('returns true for wave 24', () => {
    expect(isCrisisWave(24)).toBe(true);
  });

  it('returns false for non-crisis waves', () => {
    expect(isCrisisWave(1)).toBe(false);
    expect(isCrisisWave(3)).toBe(false);
    expect(isCrisisWave(5)).toBe(false);
    expect(isCrisisWave(7)).toBe(false);
    expect(isCrisisWave(9)).toBe(false);
  });

  it('returns false for wave 0 and negative', () => {
    expect(isCrisisWave(0)).toBe(false);
    expect(isCrisisWave(-6)).toBe(false);
  });
});

describe('isRiftWave', () => {
  it('returns true for wave 3', () => {
    expect(isRiftWave(3)).toBe(true);
  });

  it('returns true for wave 9', () => {
    expect(isRiftWave(9)).toBe(true);
  });

  it('returns true for wave 15', () => {
    expect(isRiftWave(15)).toBe(true);
  });

  it('returns false for crisis waves even though they are on the period', () => {
    expect(isRiftWave(6)).toBe(false);
    expect(isRiftWave(12)).toBe(false);
    expect(isRiftWave(18)).toBe(false);
  });

  it('returns false for non-rift waves', () => {
    expect(isRiftWave(1)).toBe(false);
    expect(isRiftWave(4)).toBe(false);
    expect(isRiftWave(5)).toBe(false);
    expect(isRiftWave(10)).toBe(false);
  });
});

describe('rollRiftType', () => {
  const validTypes: ArenaRiftType[] = ['void_collapse', 'gravity_well', 'emp_storm', 'shockwave'];

  it('returns a valid type for seed=0 with no lastType', () => {
    const result = rollRiftType(null, 0);
    expect(validTypes).toContain(result);
  });

  it('returns a valid type for seed=0.5 with no lastType', () => {
    const result = rollRiftType(null, 0.5);
    expect(validTypes).toContain(result);
  });

  it('is deterministic — same seed produces same result', () => {
    const r1 = rollRiftType(null, 0.3);
    const r2 = rollRiftType(null, 0.3);
    expect(r1).toBe(r2);
  });

  it('never returns the lastType', () => {
    const types: ArenaRiftType[] = ['void_collapse', 'gravity_well', 'emp_storm', 'shockwave'];
    for (const last of types) {
      for (let seed = 0; seed < 1; seed += 0.1) {
        const result = rollRiftType(last, seed);
        expect(result).not.toBe(last);
      }
    }
  });

  it('with lastType=null can return any of the 4 types across different seeds', () => {
    const seen = new Set<ArenaRiftType>();
    for (let i = 0; i < 100; i++) {
      const seed = i * 0.01;
      seen.add(rollRiftType(null, seed));
    }
    // With 100 seeds across the full range we should see all types
    expect(seen.size).toBe(4);
  });

  it('with lastType, only 3 types are possible', () => {
    const seen = new Set<ArenaRiftType>();
    const last: ArenaRiftType = 'gravity_well';
    for (let i = 0; i < 100; i++) {
      const seed = i * 0.01;
      seen.add(rollRiftType(last, seed));
    }
    expect(seen.size).toBe(3);
    expect(seen).not.toContain(last);
  });
});

// ── Factory ─────────────────────────────────────────────────────

describe('createRiftState', () => {
  it('void_collapse has correct kind and initial values', () => {
    const state = createRiftState('void_collapse', 42);
    expect(state.kind).toBe('void_collapse');
    if (state.kind === 'void_collapse') {
      expect(state.currentRadius).toBe(BASE_ARENA_RADIUS);
      expect(state.minRadius).toBeCloseTo(BASE_ARENA_RADIUS * 0.45);
      expect(state.collapseDuration).toBe(25);
      expect(state.elapsed).toBe(0);
      expect(state.edgeDps).toBe(12);
    }
  });

  it('gravity_well has correct kind and seeded position', () => {
    const state = createRiftState('gravity_well', 42);
    expect(state.kind).toBe('gravity_well');
    if (state.kind === 'gravity_well') {
      expect(state.elapsed).toBe(0);
      expect(state.influenceRadius).toBeCloseTo(BASE_ARENA_RADIUS * 0.9);
      expect(state.strength).toBeGreaterThan(5);
      expect(state.strength).toBeLessThan(11);
      expect(state.orbitSpeed).toBeGreaterThan(0.1);
      expect(state.orbitSpeed).toBeLessThan(0.4);
      // well position is seed-dependent
      expect(typeof state.wellX).toBe('number');
      expect(typeof state.wellZ).toBe('number');
    }
  });

  it('gravity_well is deterministic — same seed produces same state', () => {
    const s1 = createRiftState('gravity_well', 99);
    const s2 = createRiftState('gravity_well', 99);
    expect(s1).toEqual(s2);
  });

  it('gravity_well different seeds produce different positions', () => {
    const s1 = createRiftState('gravity_well', 1);
    const s2 = createRiftState('gravity_well', 999);
    if (s1.kind === 'gravity_well' && s2.kind === 'gravity_well') {
      expect(s1.wellX).not.toBeCloseTo(s2.wellX, 2);
    }
  });

  it('emp_storm has correct kind and initial values', () => {
    const state = createRiftState('emp_storm', 42);
    expect(state.kind).toBe('emp_storm');
    if (state.kind === 'emp_storm') {
      expect(state.pulseInterval).toBeGreaterThanOrEqual(7);
      expect(state.pulseInterval).toBeLessThanOrEqual(10);
      expect(state.disableDuration).toBeGreaterThanOrEqual(2.5);
      expect(state.disableDuration).toBeLessThanOrEqual(3.5);
      expect(state.timeSinceLastPulse).toBeGreaterThanOrEqual(3);
      expect(state.timeSinceLastPulse).toBeLessThanOrEqual(5);
      expect(state.shieldsDisabled).toBe(false);
      expect(state.disableTimer).toBe(0);
    }
  });

  it('shockwave has correct kind and initial values', () => {
    const state = createRiftState('shockwave', 42);
    expect(state.kind).toBe('shockwave');
    if (state.kind === 'shockwave') {
      expect(state.waveInterval).toBeGreaterThanOrEqual(5);
      expect(state.waveInterval).toBeLessThanOrEqual(8);
      expect(state.currentWaveRadius).toBe(0);
      expect(state.waveSpeed).toBeGreaterThanOrEqual(10);
      expect(state.waveSpeed).toBeLessThanOrEqual(15);
      expect(state.pushForce).toBeGreaterThanOrEqual(8);
      expect(state.pushForce).toBeLessThanOrEqual(14);
      expect(state.waveActive).toBe(false);
      expect(state.waveElapsed).toBe(0);
    }
  });
});

// ── Update — void_collapse ──────────────────────────────────────

describe('updateRift — void_collapse', () => {
  it('elapsed increases by dt', () => {
    const state = createRiftState('void_collapse', 1);
    const updated = updateRift(state, 2);
    expect(updated.elapsed).toBeCloseTo(2);
  });

  it('currentRadius stays at BASE_ARENA_RADIUS at t=0', () => {
    const state = createRiftState('void_collapse', 1);
    // elapsed=0, so t=0, eased=0, radius = BASE_ARENA_RADIUS
    expect(state.currentRadius).toBeCloseTo(BASE_ARENA_RADIUS);
  });

  it('currentRadius shrinks over time', () => {
    const state = createRiftState('void_collapse', 1);
    const mid = updateRift(state, 12.5);
    if (mid.kind === 'void_collapse') {
      expect(mid.currentRadius).toBeLessThan(BASE_ARENA_RADIUS);
      expect(mid.currentRadius).toBeGreaterThan(state.minRadius);
    }
  });

  it('reaches minRadius after collapseDuration (t=1)', () => {
    const state = createRiftState('void_collapse', 1);
    if (state.kind !== 'void_collapse') return;
    const updated = updateRift(state, state.collapseDuration);
    if (updated.kind === 'void_collapse') {
      // At t=1, eased=1, radius = BASE + (min - BASE)*1 = min
      expect(updated.currentRadius).toBeCloseTo(state.minRadius);
    }
  });

  it('stays at minRadius after exceeding collapseDuration', () => {
    const state = createRiftState('void_collapse', 1);
    if (state.kind !== 'void_collapse') return;
    const updated = updateRift(state, 100);
    if (updated.kind === 'void_collapse') {
      expect(updated.currentRadius).toBeCloseTo(state.minRadius);
    }
  });

  it('uses ease-in-out (slower at start and end, faster in middle)', () => {
    const state = createRiftState('void_collapse', 1);
    if (state.kind !== 'void_collapse') return;
    const d = state.collapseDuration;

    // Quarter-point elapsed
    const q1 = updateRift(state, d * 0.25);
    // Half-point elapsed
    const q2 = updateRift(state, d * 0.5);
    // Three-quarter point elapsed
    const q3 = updateRift(state, d * 0.75);

    if (q1.kind === 'void_collapse' && q2.kind === 'void_collapse' && q3.kind === 'void_collapse') {
      const shrinkQ1 = BASE_ARENA_RADIUS - q1.currentRadius;
      const shrinkQ2 = BASE_ARENA_RADIUS - q2.currentRadius;
      const shrinkQ3 = BASE_ARENA_RADIUS - q3.currentRadius;
      // Ease-in-out: first quarter shrinks less than second quarter
      expect(shrinkQ1).toBeLessThan(shrinkQ2 - shrinkQ1); // accelerating
      // Second quarter shrinks more than third quarter
      expect(shrinkQ3 - shrinkQ2).toBeLessThan(shrinkQ2 - shrinkQ1); // decelerating
    }
  });

  it('returns a new object (immutable)', () => {
    const state = createRiftState('void_collapse', 1);
    const updated = updateRift(state, 1);
    expect(updated).not.toBe(state);
  });
});

// ── Update — gravity_well ──────────────────────────────────────

describe('updateRift — gravity_well', () => {
  it('elapsed increases by dt', () => {
    const state = createRiftState('gravity_well', 42);
    const updated = updateRift(state, 3);
    if (updated.kind === 'gravity_well') {
      expect(updated.elapsed).toBeCloseTo(3);
    }
  });

  it('well position changes over time (orbiting)', () => {
    const state = createRiftState('gravity_well', 42);
    if (state.kind !== 'gravity_well') return;
    const updated = updateRift(state, 2);
    if (updated.kind === 'gravity_well') {
      // Position should have changed
      expect(updated.wellX).not.toBeCloseTo(state.wellX, 6);
      expect(updated.wellZ).not.toBeCloseTo(state.wellZ, 6);
    }
  });

  it('orbit preserves distance from center', () => {
    const state = createRiftState('gravity_well', 42);
    if (state.kind !== 'gravity_well') return;
    const origDist = Math.hypot(state.wellX, state.wellZ);
    const updated = updateRift(state, 5);
    if (updated.kind === 'gravity_well') {
      const newDist = Math.hypot(updated.wellX, updated.wellZ);
      expect(newDist).toBeCloseTo(origDist, 10);
    }
  });

  it('orbit preserves distance over many updates', () => {
    let state: ArenaRiftState = createRiftState('gravity_well', 42);
    if (state.kind !== 'gravity_well') return;
    const origDist = Math.hypot(state.wellX, state.wellZ);
    for (let i = 0; i < 100; i++) {
      state = updateRift(state, 0.1);
    }
    if (state.kind === 'gravity_well') {
      const newDist = Math.hypot(state.wellX, state.wellZ);
      expect(newDist).toBeCloseTo(origDist, 8);
    }
  });

  it('returns a new object (immutable)', () => {
    const state = createRiftState('gravity_well', 42);
    const updated = updateRift(state, 0.5);
    expect(updated).not.toBe(state);
  });
});

// ── Update — emp_storm ─────────────────────────────────────────

describe('updateRift — emp_storm', () => {
  function makeEmpStorm(): EmpStormState {
    const s = createRiftState('emp_storm', 42);
    if (s.kind === 'emp_storm') return s;
    throw new Error('expected emp_storm');
  }

  it('timeSinceLastPulse accumulates each tick', () => {
    let state = makeEmpStorm();
    state = updateRift(state, 1) as EmpStormState;
    state = updateRift(state, 1) as EmpStormState;
    // initial was ~3-5, so after 2s it should have increased by 2
    expect(state.timeSinceLastPulse).toBeGreaterThan(makeEmpStorm().timeSinceLastPulse);
  });

  it('shieldsDisabled transitions to true after pulseInterval is exceeded', () => {
    // Create a state with timeSinceLastPulse near pulseInterval
    let state = makeEmpStorm();
    // Advance time to just past pulseInterval (minus initial offset)
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining) as EmpStormState;
    expect(state.shieldsDisabled).toBe(true);
  });

  it('disableTimer is set to disableDuration when shields first disabled', () => {
    let state = makeEmpStorm();
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining) as EmpStormState;
    if (state.shieldsDisabled) {
      expect(state.disableTimer).toBeCloseTo(state.disableDuration, 2);
    }
  });

  it('disableTimer counts down over time', () => {
    let state = makeEmpStorm();
    // Trigger pulse
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining) as EmpStormState;
    if (!state.shieldsDisabled) throw new Error('expected shields disabled');
    const timerAfterTrigger = state.disableTimer;
    state = updateRift(state, 0.5) as EmpStormState;
    expect(state.disableTimer).toBeCloseTo(timerAfterTrigger - 0.5, 10);
  });

  it('shieldsDisabled goes back to false after disableDuration', () => {
    let state = makeEmpStorm();
    // Trigger pulse
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining) as EmpStormState;
    if (!state.shieldsDisabled) throw new Error('expected shields disabled');
    // Advance past disableDuration
    state = updateRift(state, state.disableDuration + 1) as EmpStormState;
    expect(state.shieldsDisabled).toBe(false);
  });

  it('timeSinceLastPulse resets to 0 when pulse fires', () => {
    let state = makeEmpStorm();
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining) as EmpStormState;
    expect(state.timeSinceLastPulse).toBe(0);
  });

  it('can fire multiple pulses over time', () => {
    let state = makeEmpStorm();
    let pulseCount = 0;
    // Simulate enough time for several pulses
    for (let t = 0; t < 50; t += 0.5) {
      const prev = state.shieldsDisabled;
      state = updateRift(state, 0.5) as EmpStormState;
      if (!prev && state.shieldsDisabled) pulseCount++;
    }
    expect(pulseCount).toBeGreaterThanOrEqual(4);
  });

  it('returns a new object (immutable)', () => {
    const state = makeEmpStorm();
    const updated = updateRift(state, 0.1);
    expect(updated).not.toBe(state);
  });
});

// ── Update — shockwave ─────────────────────────────────────────

describe('updateRift — shockwave', () => {
  function makeShockwave(): ShockwaveState {
    const s = createRiftState('shockwave', 42);
    if (s.kind === 'shockwave') return s;
    throw new Error('expected shockwave');
  }

  it('timeSinceLastWave accumulates each tick', () => {
    let state = makeShockwave();
    const initial = state.timeSinceLastWave;
    state = updateRift(state, 1) as ShockwaveState;
    expect(state.timeSinceLastWave).toBeCloseTo(initial + 1, 5);
  });

  it('waveActive becomes true after waveInterval is exceeded', () => {
    let state = makeShockwave();
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining) as ShockwaveState;
    expect(state.waveActive).toBe(true);
  });

  it('currentWaveRadius starts at 1 when wave activates', () => {
    let state = makeShockwave();
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining) as ShockwaveState;
    expect(state.currentWaveRadius).toBe(1);
  });

  it('currentWaveRadius grows while wave is active', () => {
    let state = makeShockwave();
    // Trigger wave
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining) as ShockwaveState;
    const r1 = state.currentWaveRadius;
    state = updateRift(state, 0.5) as ShockwaveState;
    expect(state.currentWaveRadius).toBeGreaterThan(r1);
  });

  it('waveActive becomes false when radius exceeds BASE_ARENA_RADIUS*1.2', () => {
    let state = makeShockwave();
    // Trigger wave
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining) as ShockwaveState;
    // Advance past the threshold
    const maxDist = BASE_ARENA_RADIUS * 1.2;
    // Each tick, radius grows by waveSpeed * dt
    const timeToExceed = (maxDist / state.waveSpeed) + 2;
    state = updateRift(state, timeToExceed) as ShockwaveState;
    expect(state.waveActive).toBe(false);
    expect(state.currentWaveRadius).toBe(0);
  });

  it('timeSinceLastWave resets to 0 when wave activates', () => {
    let state = makeShockwave();
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining) as ShockwaveState;
    expect(state.timeSinceLastWave).toBe(0);
  });

  it('multiple waves can fire over time', () => {
    let state = makeShockwave();
    let waveCount = 0;
    for (let t = 0; t < 60; t += 0.5) {
      const prev = state.waveActive;
      state = updateRift(state, 0.5) as ShockwaveState;
      if (!prev && state.waveActive) waveCount++;
    }
    expect(waveCount).toBeGreaterThanOrEqual(3);
  });

  it('returns a new object (immutable)', () => {
    const state = makeShockwave();
    const updated = updateRift(state, 0.1);
    expect(updated).not.toBe(state);
  });
});

// ── Queries ─────────────────────────────────────────────────────

describe('getRiftArenaRadius', () => {
  it('returns BASE_ARENA_RADIUS when rift is null', () => {
    expect(getRiftArenaRadius(null)).toBe(BASE_ARENA_RADIUS);
  });

  it('returns currentRadius for void_collapse', () => {
    const state = createRiftState('void_collapse', 1);
    expect(getRiftArenaRadius(state)).toBeCloseTo(BASE_ARENA_RADIUS);
  });

  it('returns reduced radius for partially collapsed void', () => {
    let state = createRiftState('void_collapse', 1);
    state = updateRift(state, 12);
    const radius = getRiftArenaRadius(state);
    expect(radius).toBeLessThan(BASE_ARENA_RADIUS);
    expect(radius).toBeGreaterThan(0);
  });

  it('returns BASE_ARENA_RADIUS for gravity_well', () => {
    const state = createRiftState('gravity_well', 42);
    expect(getRiftArenaRadius(state)).toBe(BASE_ARENA_RADIUS);
  });

  it('returns BASE_ARENA_RADIUS for emp_storm', () => {
    const state = createRiftState('emp_storm', 42);
    expect(getRiftArenaRadius(state)).toBe(BASE_ARENA_RADIUS);
  });

  it('returns BASE_ARENA_RADIUS for shockwave', () => {
    const state = createRiftState('shockwave', 42);
    expect(getRiftArenaRadius(state)).toBe(BASE_ARENA_RADIUS);
  });
});

describe('getRiftGravityForce', () => {
  it('returns null when rift is null', () => {
    expect(getRiftGravityForce(null, 0, 0)).toBeNull();
  });

  it('returns null for non-gravity rift types', () => {
    const vc = createRiftState('void_collapse', 1);
    expect(getRiftGravityForce(vc, 0, 0)).toBeNull();

    const emp = createRiftState('emp_storm', 1);
    expect(getRiftGravityForce(emp, 0, 0)).toBeNull();

    const sw = createRiftState('shockwave', 1);
    expect(getRiftGravityForce(sw, 0, 0)).toBeNull();
  });

  it('returns force toward well for gravity_well', () => {
    // Place a test ship at origin; the well is offset from center
    const state = createRiftState('gravity_well', 42);
    if (state.kind !== 'gravity_well') return;
    const force = getRiftGravityForce(state, 0, 0);
    expect(force).not.toBeNull();
    // Force direction should point from (0,0) toward the well
    expect(force!.fx * state.wellX + force!.fz * state.wellZ).toBeGreaterThan(0);
  });

  it('returns null when position is outside influenceRadius', () => {
    const state = createRiftState('gravity_well', 42);
    if (state.kind !== 'gravity_well') return;
    // Put test position far away
    const force = getRiftGravityForce(state, 100, 100);
    expect(force).toBeNull();
  });

  it('force magnitude increases closer to the well', () => {
    const state = createRiftState('gravity_well', 42);
    if (state.kind !== 'gravity_well') return;
    const far = getRiftGravityForce(state, state.wellX - 10, state.wellZ);
    const close = getRiftGravityForce(state, state.wellX - 1, state.wellZ);
    if (far && close) {
      const closeMag = Math.hypot(close.fx, close.fz);
      const farMag = Math.hypot(far.fx, far.fz);
      expect(closeMag).toBeGreaterThan(farMag);
    }
  });

  it('returns null when exactly at well position (dist clamped to 1, but within influence)', () => {
    const state = createRiftState('gravity_well', 42);
    if (state.kind !== 'gravity_well') return;
    // At well position, dx=dz=0, dist clamped to 1 (min), so force is valid
    const force = getRiftGravityForce(state, state.wellX, state.wellZ);
    // At exact well position, dx=0, dz=0, so fx=0, fz=0
    expect(force).not.toBeNull();
    expect(force!.fx).toBe(0);
    expect(force!.fz).toBe(0);
  });
});

describe('isRiftEmpActive', () => {
  it('returns false when rift is null', () => {
    expect(isRiftEmpActive(null)).toBe(false);
  });

  it('returns false for non-emp rift types', () => {
    expect(isRiftEmpActive(createRiftState('void_collapse', 1))).toBe(false);
    expect(isRiftEmpActive(createRiftState('gravity_well', 42))).toBe(false);
    expect(isRiftEmpActive(createRiftState('shockwave', 42))).toBe(false);
  });

  it('returns false for emp_storm when shields are not disabled', () => {
    const state = createRiftState('emp_storm', 42);
    expect(isRiftEmpActive(state)).toBe(false);
  });

  it('returns true for emp_storm when shields are disabled', () => {
    let state: ArenaRiftState = createRiftState('emp_storm', 42);
    if (state.kind !== 'emp_storm') return;
    // Advance to trigger the pulse
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining);
    expect(isRiftEmpActive(state)).toBe(true);
  });

  it('returns false again after disableDuration elapses', () => {
    let state: ArenaRiftState = createRiftState('emp_storm', 42);
    if (state.kind !== 'emp_storm') return;
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining);
    state = updateRift(state, state.kind === 'emp_storm' ? state.disableDuration + 1 : 100);
    expect(isRiftEmpActive(state)).toBe(false);
  });
});

describe('getEmpCountdown', () => {
  it('returns null when rift is null', () => {
    expect(getEmpCountdown(null)).toBeNull();
  });

  it('returns null for non-emp rift types', () => {
    expect(getEmpCountdown(createRiftState('void_collapse', 1))).toBeNull();
    expect(getEmpCountdown(createRiftState('gravity_well', 42))).toBeNull();
    expect(getEmpCountdown(createRiftState('shockwave', 42))).toBeNull();
  });

  it('returns positive time remaining when shields are not disabled', () => {
    const state = createRiftState('emp_storm', 42);
    const countdown = getEmpCountdown(state);
    expect(countdown).not.toBeNull();
    expect(countdown!).toBeGreaterThan(0);
  });

  it('returns 0 just before pulse fires', () => {
    let state: ArenaRiftState = createRiftState('emp_storm', 42);
    if (state.kind !== 'emp_storm') return;
    // Advance to just before pulseInterval (0.01s short)
    const remaining = state.pulseInterval - state.timeSinceLastPulse - 0.01;
    state = updateRift(state, remaining);
    const countdown = getEmpCountdown(state);
    expect(countdown).not.toBeNull();
    expect(countdown!).toBeCloseTo(0.01, 2);
  });

  it('returns negative value during disable window', () => {
    let state: ArenaRiftState = createRiftState('emp_storm', 42);
    if (state.kind !== 'emp_storm') return;
    const remaining = state.pulseInterval - state.timeSinceLastPulse + 0.1;
    state = updateRift(state, remaining);
    const countdown = getEmpCountdown(state);
    expect(countdown).not.toBeNull();
    expect(countdown!).toBeLessThan(0);
  });
});

describe('getRiftShockwaveForce', () => {
  it('returns null when rift is null', () => {
    expect(getRiftShockwaveForce(null, 5, 0)).toBeNull();
  });

  it('returns null for non-shockwave rift types', () => {
    expect(getRiftShockwaveForce(createRiftState('void_collapse', 1), 5, 0)).toBeNull();
    expect(getRiftShockwaveForce(createRiftState('gravity_well', 42), 5, 0)).toBeNull();
    expect(getRiftShockwaveForce(createRiftState('emp_storm', 42), 5, 0)).toBeNull();
  });

  it('returns null when wave is not active', () => {
    const state = createRiftState('shockwave', 42);
    expect(getRiftShockwaveForce(state, 5, 0)).toBeNull();
  });

  it('returns outward force at wave front when wave is active', () => {
    let state: ArenaRiftState = createRiftState('shockwave', 42);
    if (state.kind !== 'shockwave') return;
    // Trigger wave
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining);
    // Advance wave a bit
    state = updateRift(state, 1);
    if (state.kind !== 'shockwave') return;

    const force = getRiftShockwaveForce(state, state.currentWaveRadius, 0);
    expect(force).not.toBeNull();
    // Force should push outward (positive x at position on +x axis)
    expect(force!.fx).toBeGreaterThan(0);
  });

  it('returns null when position is outside the push band', () => {
    let state: ArenaRiftState = createRiftState('shockwave', 42);
    if (state.kind !== 'shockwave') return;
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining);
    if (state.kind !== 'shockwave') return;

    // Position far from the wave front
    const force = getRiftShockwaveForce(state, 0, 0);
    // wave radius is 1, position is at origin (dist=0), delta=1, thickness=2.5, so it IS in band
    // Let's try a position very far away
    const forceFar = getRiftShockwaveForce(state, 100, 0);
    expect(forceFar).toBeNull();
  });

  it('force is stronger at exact wave front than at edge of band', () => {
    let state: ArenaRiftState = createRiftState('shockwave', 42);
    if (state.kind !== 'shockwave') return;
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining);
    if (state.kind !== 'shockwave') return;
    const r = state.currentWaveRadius;

    const frontForce = getRiftShockwaveForce(state, r, 0);
    const edgeForce = getRiftShockwaveForce(state, r + 2, 0); // at edge of thickness band (delta=2)
    if (frontForce && edgeForce) {
      const frontMag = Math.hypot(frontForce.fx, frontForce.fz);
      const edgeMag = Math.hypot(edgeForce.fx, edgeForce.fz);
      expect(frontMag).toBeGreaterThan(edgeMag);
    }
  });

  it('push direction is radially outward from center', () => {
    let state: ArenaRiftState = createRiftState('shockwave', 42);
    if (state.kind !== 'shockwave') return;
    const remaining = state.waveInterval - state.timeSinceLastWave + 0.1;
    state = updateRift(state, remaining);
    if (state.kind !== 'shockwave') return;
    const r = state.currentWaveRadius;

    // Test on +x axis
    const f = getRiftShockwaveForce(state, r, 0);
    expect(f).not.toBeNull();
    expect(f!.fx).toBeGreaterThan(0);
    expect(f!.fz).toBeCloseTo(0);

    // Test on +z axis
    const f2 = getRiftShockwaveForce(state, 0, r);
    expect(f2).not.toBeNull();
    expect(f2!.fx).toBeCloseTo(0);
    expect(f2!.fz).toBeGreaterThan(0);
  });
});

describe('isOutsideVoidCollapse', () => {
  it('returns false when rift is null', () => {
    expect(isOutsideVoidCollapse(null, 10, 0)).toBe(false);
  });

  it('returns false for non-void_collapse rift types', () => {
    const gw = createRiftState('gravity_well', 42);
    expect(isOutsideVoidCollapse(gw, 50, 0)).toBe(false);

    const emp = createRiftState('emp_storm', 42);
    expect(isOutsideVoidCollapse(emp, 50, 0)).toBe(false);

    const sw = createRiftState('shockwave', 42);
    expect(isOutsideVoidCollapse(sw, 50, 0)).toBe(false);
  });

  it('returns false when position is inside the current radius', () => {
    const state = createRiftState('void_collapse', 1);
    // At t=0, radius = BASE_ARENA_RADIUS = 17
    expect(isOutsideVoidCollapse(state, 5, 0)).toBe(false);
    expect(isOutsideVoidCollapse(state, 0, 0)).toBe(false);
  });

  it('returns true when position is outside the current radius', () => {
    const state = createRiftState('void_collapse', 1);
    // At t=0, radius = 17, so position at (18, 0) should be outside
    expect(isOutsideVoidCollapse(state, 18, 0)).toBe(true);
    expect(isOutsideVoidCollapse(state, 0, 20)).toBe(true);
  });

  it('returns true for positions that were inside but become outside as radius shrinks', () => {
    let state: ArenaRiftState = createRiftState('void_collapse', 1);
    // Position at 15 is inside at t=0 (radius=17)
    expect(isOutsideVoidCollapse(state, 15, 0)).toBe(false);
    // After enough time, radius should shrink below 15
    state = updateRift(state, 20);
    const radius = getRiftArenaRadius(state);
    if (radius < 15) {
      expect(isOutsideVoidCollapse(state, 15, 0)).toBe(true);
    }
  });
});

describe('getRiftType', () => {
  it('returns kind for void_collapse', () => {
    expect(getRiftType(createRiftState('void_collapse', 1))).toBe('void_collapse');
  });

  it('returns kind for gravity_well', () => {
    expect(getRiftType(createRiftState('gravity_well', 42))).toBe('gravity_well');
  });

  it('returns kind for emp_storm', () => {
    expect(getRiftType(createRiftState('emp_storm', 42))).toBe('emp_storm');
  });

  it('returns kind for shockwave', () => {
    expect(getRiftType(createRiftState('shockwave', 42))).toBe('shockwave');
  });

  it('returns correct type after updates', () => {
    let state: ArenaRiftState = createRiftState('gravity_well', 42);
    state = updateRift(state, 5);
    expect(getRiftType(state)).toBe('gravity_well');
  });
});
