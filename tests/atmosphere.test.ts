import { describe, it, expect } from 'vitest';
import {
  createAtmosphere,
  tickAtmosphere,
  type AtmosphereInput,
  type AtmosphereState,
} from '../src/game/atmosphere';

function idleInput(): AtmosphereInput {
  return {
    intensity: 0,
    hpFraction: 1,
    comboKills: 0,
    overdriveActive: false,
    bossAlive: false,
    nearMissActive: false,
    elapsed: 0,
    waveActive: false,
  };
}

describe('createAtmosphere', () => {
  it('returns default state with zero vignettes', () => {
    const s = createAtmosphere();
    expect(s.gridBrightness).toBe(0);
    expect(s.dangerVignette).toBe(0);
    expect(s.comboShimmer).toBe(0);
    expect(s.overdriveVignette).toBe(0);
    expect(s.starBrightness).toBe(0.7);
    expect(s._smoothIntensity).toBe(0);
    expect(s._smoothHpFraction).toBe(1);
    expect(s._smoothCombo).toBe(0);
  });
});

describe('tickAtmosphere — grid brightness', () => {
  it('stays dark at intensity 0', () => {
    let s = createAtmosphere();
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, idleInput(), 1 / 60);
    expect(s.gridBrightness).toBe(0);
  });

  it('ramps up with combat intensity', () => {
    let s = createAtmosphere();
    const combat = { ...idleInput(), intensity: 3, waveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, combat, 1 / 60);
    expect(s.gridBrightness).toBeGreaterThan(0.3);
    expect(s.gridBrightness).toBeLessThanOrEqual(1);
  });

  it('pulses during combat (not flat)', () => {
    let s = createAtmosphere();
    const combat = { ...idleInput(), intensity: 3, waveActive: true };
    let min = 1, max = 0;
    for (let i = 0; i < 300; i++) {
      s = tickAtmosphere(s, { ...combat, elapsed: i / 60 }, 1 / 60);
      min = Math.min(min, s.gridBrightness);
      max = Math.max(max, s.gridBrightness);
    }
    // Grid should oscillate due to pulse
    expect(max - min).toBeGreaterThan(0.02);
  });

  it('does not pulse at idle', () => {
    let s = createAtmosphere();
    let min = 1, max = 0;
    for (let i = 0; i < 120; i++) {
      s = tickAtmosphere(s, { ...idleInput(), elapsed: i / 60 }, 1 / 60);
      min = Math.min(min, s.gridBrightness);
      max = Math.max(max, s.gridBrightness);
    }
    expect(max - min).toBeLessThan(0.001);
  });
});

describe('tickAtmosphere — ring color', () => {
  it('is blue at idle', () => {
    let s = createAtmosphere();
    for (let i = 0; i < 60; i++) s = tickAtmosphere(s, idleInput(), 1 / 60);
    // Idle ring color should be in the blue-gray range
    expect(s.ringColor).toMatch(/^#1f3a57$/);
  });

  it('turns crimson when boss is alive', () => {
    let s = createAtmosphere();
    const boss = { ...idleInput(), intensity: 2, bossAlive: true, waveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, boss, 1 / 60);
    // Boss forces ring to intensity-5 crimson
    expect(s.ringColor).toMatch(/^#dc2626$/);
  });
});

describe('tickAtmosphere — danger vignette', () => {
  it('stays zero at full HP', () => {
    let s = createAtmosphere();
    const fullHp = { ...idleInput(), hpFraction: 1, waveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, fullHp, 1 / 60);
    expect(s.dangerVignette).toBe(0);
  });

  it('stays zero below 30% HP when no wave active', () => {
    let s = createAtmosphere();
    const lowHp = { ...idleInput(), hpFraction: 0.1, waveActive: false };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, lowHp, 1 / 60);
    expect(s.dangerVignette).toBe(0);
  });

  it('ramps up below 30% HP during active wave', () => {
    let s = createAtmosphere();
    const critical = { ...idleInput(), hpFraction: 0.05, waveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, critical, 1 / 60);
    expect(s.dangerVignette).toBeGreaterThan(0.5);
  });

  it('is stronger at 5% HP than at 25% HP', () => {
    let s1 = createAtmosphere();
    let s2 = createAtmosphere();
    const nearDeath = { ...idleInput(), hpFraction: 0.05, waveActive: true };
    const caution = { ...idleInput(), hpFraction: 0.25, waveActive: true };
    for (let i = 0; i < 180; i++) {
      s1 = tickAtmosphere(s1, nearDeath, 1 / 60);
      s2 = tickAtmosphere(s2, caution, 1 / 60);
    }
    expect(s1.dangerVignette).toBeGreaterThan(s2.dangerVignette);
  });

  it('smoothly fades back to zero when HP recovers', () => {
    let s = createAtmosphere();
    const critical = { ...idleInput(), hpFraction: 0.05, waveActive: true };
    const healed = { ...idleInput(), hpFraction: 0.8, waveActive: true };
    for (let i = 0; i < 180; i++) s = tickAtmosphere(s, critical, 1 / 60);
    expect(s.dangerVignette).toBeGreaterThan(0.5);
    for (let i = 0; i < 180; i++) s = tickAtmosphere(s, healed, 1 / 60);
    expect(s.dangerVignette).toBeLessThan(0.05);
  });
});

describe('tickAtmosphere — combo shimmer', () => {
  it('stays zero with no kills', () => {
    let s = createAtmosphere();
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, idleInput(), 1 / 60);
    expect(s.comboShimmer).toBe(0);
  });

  it('stays zero below 5 kills', () => {
    let s = createAtmosphere();
    const lowCombo = { ...idleInput(), comboKills: 3 };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, lowCombo, 1 / 60);
    expect(s.comboShimmer).toBeLessThan(0.01);
  });

  it('ramps up at 10+ kills', () => {
    let s = createAtmosphere();
    const midCombo = { ...idleInput(), comboKills: 10 };
    for (let i = 0; i < 180; i++) s = tickAtmosphere(s, midCombo, 1 / 60);
    expect(s.comboShimmer).toBeGreaterThan(0.1);
  });

  it('approaches max at 20+ kills', () => {
    let s = createAtmosphere();
    const highCombo = { ...idleInput(), comboKills: 20 };
    for (let i = 0; i < 300; i++) s = tickAtmosphere(s, highCombo, 1 / 60);
    // Max target is min(1, (20-5)/15) = 1.0, with sin oscillation
    expect(s.comboShimmer).toBeGreaterThan(0.3);
  });
});

describe('tickAtmosphere — overdrive vignette', () => {
  it('stays zero when overdrive is inactive', () => {
    let s = createAtmosphere();
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, idleInput(), 1 / 60);
    expect(s.overdriveVignette).toBe(0);
  });

  it('ramps up when overdrive activates', () => {
    let s = createAtmosphere();
    const od = { ...idleInput(), overdriveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, od, 1 / 60);
    expect(s.overdriveVignette).toBeGreaterThan(0.3);
  });

  it('pulses during overdrive (sinusoidal)', () => {
    let s = createAtmosphere();
    const od = { ...idleInput(), overdriveActive: true };
    let min = 1, max = 0;
    for (let i = 0; i < 600; i++) {
      s = tickAtmosphere(s, { ...od, elapsed: i / 60 }, 1 / 60);
      min = Math.min(min, s.overdriveVignette);
      max = Math.max(max, s.overdriveVignette);
    }
    expect(max - min).toBeGreaterThan(0.1);
  });

  it('fades back to zero when overdrive ends', () => {
    let s = createAtmosphere();
    const od = { ...idleInput(), overdriveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, od, 1 / 60);
    expect(s.overdriveVignette).toBeGreaterThan(0.3);
    const off = { ...idleInput() };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, off, 1 / 60);
    expect(s.overdriveVignette).toBeLessThan(0.05);
  });
});

describe('tickAtmosphere — near-miss effects', () => {
  it('boosts star brightness during near-miss', () => {
    let s = createAtmosphere();
    const nearMiss = { ...idleInput(), nearMissActive: true };
    for (let i = 0; i < 60; i++) s = tickAtmosphere(s, nearMiss, 1 / 60);
    expect(s.starBrightness).toBeGreaterThan(1.5);
  });

  it('reduces star twinkle during near-miss', () => {
    let s = createAtmosphere();
    const nearMiss = { ...idleInput(), nearMissActive: true };
    for (let i = 0; i < 60; i++) s = tickAtmosphere(s, nearMiss, 1 / 60);
    expect(s.starTwinkle).toBeLessThan(0.3);
  });
});

describe('tickAtmosphere — fog', () => {
  it('tightens fog during boss fight', () => {
    let s1 = createAtmosphere();
    let s2 = createAtmosphere();
    const boss = { ...idleInput(), intensity: 3, bossAlive: true };
    const normal = { ...idleInput(), intensity: 3 };
    for (let i = 0; i < 120; i++) {
      s1 = tickAtmosphere(s1, boss, 1 / 60);
      s2 = tickAtmosphere(s2, normal, 1 / 60);
    }
    expect(s1.fogFar).toBeLessThan(s2.fogFar);
  });
});

describe('tickAtmosphere — nebula', () => {
  it('pushes nebula toward red at low HP', () => {
    let s = createAtmosphere();
    const lowHp = { ...idleInput(), intensity: 1, hpFraction: 0.1, waveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, lowHp, 1 / 60);
    // At intensity 1 but low HP, nebula should be pushed toward warm/red
    expect(s.nebulaColor).toMatch(/^#[a-f0-9]{6}$/);
    // The nebula color at intensity 3.5+ should have red component > green
    const r = parseInt(s.nebulaColor.slice(1, 3), 16);
    const g = parseInt(s.nebulaColor.slice(3, 5), 16);
    expect(r).toBeGreaterThan(g);
  });

  it('overrides to purple during overdrive', () => {
    let s = createAtmosphere();
    const od = { ...idleInput(), overdriveActive: true };
    for (let i = 0; i < 120; i++) s = tickAtmosphere(s, od, 1 / 60);
    expect(s.nebulaColor).toMatch(/^#a855f7$/);
  });
});

describe('tickAtmosphere — ring pulse', () => {
  it('pulses faster and harder during boss', () => {
    let s = createAtmosphere();
    const boss = { ...idleInput(), bossAlive: true };
    let oscillations = 0;
    let lastPulse = 0;
    for (let i = 0; i < 600; i++) {
      s = tickAtmosphere(s, { ...boss, elapsed: i / 60 }, 1 / 60);
      if (s.ringPulse > 0.7 && lastPulse <= 0.7) oscillations++;
      lastPulse = s.ringPulse;
    }
    // 10 seconds, boss pulse at 4Hz → should see ~40 oscillations
    expect(oscillations).toBeGreaterThan(10);
  });
});

describe('tickAtmosphere — smoothing', () => {
  it('smooths intensity changes (does not snap instantly)', () => {
    const s0 = createAtmosphere();
    // Jump from 0 to 5
    const s1 = tickAtmosphere(s0, { ...idleInput(), intensity: 5 }, 1 / 60);
    expect(s1._smoothIntensity).toBeGreaterThan(0);
    expect(s1._smoothIntensity).toBeLessThan(5);
  });

  it('converges to target over time', () => {
    let s = createAtmosphere();
    const high = { ...idleInput(), intensity: 5 };
    for (let i = 0; i < 600; i++) s = tickAtmosphere(s, high, 1 / 60);
    expect(s._smoothIntensity).toBeCloseTo(5, 1);
  });
});

describe('tickAtmosphere — multiple vignettes compose', () => {
  it('can have danger + combo + overdrive active simultaneously', () => {
    let s = createAtmosphere();
    const intense = {
      ...idleInput(),
      intensity: 4,
      hpFraction: 0.1,
      comboKills: 15,
      overdriveActive: true,
      bossAlive: false,
      waveActive: true,
    };
    for (let i = 0; i < 300; i++) {
      s = tickAtmosphere(s, { ...intense, elapsed: i / 60 }, 1 / 60);
    }
    // All three vignettes should be active
    expect(s.dangerVignette).toBeGreaterThan(0.3);
    expect(s.comboShimmer).toBeGreaterThan(0.1);
    expect(s.overdriveVignette).toBeGreaterThan(0.2);
  });
});
