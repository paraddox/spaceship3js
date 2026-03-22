import { describe, it, expect } from 'vitest';
import {
  generateEndlessWave,
  endlessWaveCredits,
  endlessWaveScore,
} from '../src/game/endless-generator';

describe('generateEndlessWave', () => {
  it('generates a wave with at least 1 enemy', () => {
    for (let w = 1; w <= 25; w++) {
      const wave = generateEndlessWave(w);
      expect(wave.enemies.length).toBeGreaterThanOrEqual(1);
      expect(wave.name).toBeTruthy();
    }
  });

  it('wave 1 starts with 1-2 basic enemies', () => {
    const wave = generateEndlessWave(1);
    expect(wave.enemies.length).toBeLessThanOrEqual(2);
    // All enemies should be scout-class (no frigate)
    for (const enemy of wave.enemies) {
      expect(enemy.blueprint.modules.length).toBeLessThanOrEqual(7);
    }
  });

  it('every 5th wave is a boss wave with frigate', () => {
    for (const w of [5, 10, 15, 20]) {
      const wave = generateEndlessWave(w);
      expect(wave.enemies.length).toBeGreaterThanOrEqual(1);
      // Boss waves have at least one frigate-class enemy
      const hasFrigate = wave.enemies.some(
        (e) => e.blueprint.modules.length >= 10,
      );
      expect(hasFrigate).toBe(true);
    }
  });

  it('deterministic: same wave number produces same wave', () => {
    const wave1 = generateEndlessWave(7);
    const wave2 = generateEndlessWave(7);
    expect(wave1.name).toBe(wave2.name);
    expect(wave1.enemies.length).toBe(wave2.enemies.length);
    for (let i = 0; i < wave1.enemies.length; i++) {
      expect(wave1.enemies[i].blueprint.name).toBe(wave2.enemies[i].blueprint.name);
      expect(wave1.enemies[i].position.x).toBeCloseTo(wave2.enemies[i].position.x);
      expect(wave1.enemies[i].position.z).toBeCloseTo(wave2.enemies[i].position.z);
    }
  });

  it('enemy count scales with wave number', () => {
    const earlyWave = generateEndlessWave(1);
    const midWave = generateEndlessWave(12);
    const lateWave = generateEndlessWave(22);
    expect(earlyWave.enemies.length).toBeLessThanOrEqual(midWave.enemies.length);
    expect(midWave.enemies.length).toBeLessThanOrEqual(lateWave.enemies.length);
  });

  it('later waves have lower fire jitter (more accurate enemies)', () => {
    const earlyWave = generateEndlessWave(1);
    const lateWave = generateEndlessWave(20);
    const earlyAvgJitter = earlyWave.enemies.reduce((s, e) => s + e.fireJitter, 0) / earlyWave.enemies.length;
    const lateAvgJitter = lateWave.enemies.reduce((s, e) => s + e.fireJitter, 0) / lateWave.enemies.length;
    expect(lateAvgJitter).toBeLessThan(earlyAvgJitter);
  });

  it('enemies spawn in valid arena positions', () => {
    for (let w = 1; w <= 15; w++) {
      const wave = generateEndlessWave(w);
      for (const enemy of wave.enemies) {
        const dist = Math.hypot(enemy.position.x, enemy.position.z);
        expect(dist).toBeLessThanOrEqual(40); // within MAX_WORLD_RADIUS
      }
    }
  });

  it('wave names are meaningful', () => {
    expect(generateEndlessWave(1).name).toContain('Patrol');
    expect(generateEndlessWave(5).name).toContain('Boss');
    expect(generateEndlessWave(10).name).toContain('Boss');
    expect(generateEndlessWave(8).name).toContain('Raid');
  });

  it('non-boss waves never have frigates before wave 11', () => {
    for (let w = 1; w <= 10; w++) {
      if (w % 5 === 0) continue; // skip boss waves
      const wave = generateEndlessWave(w);
      for (const enemy of wave.enemies) {
        // All non-boss waves before wave 11 should be scouts
        expect(enemy.blueprint.modules.length).toBeLessThanOrEqual(7);
      }
    }
  });
});

describe('endlessWaveCredits', () => {
  it('increases with wave number', () => {
    expect(endlessWaveCredits(1)).toBeLessThan(endlessWaveCredits(5));
    expect(endlessWaveCredits(5)).toBeLessThan(endlessWaveCredits(10));
  });

  it('boss waves give more credits', () => {
    expect(endlessWaveCredits(5)).toBeGreaterThan(endlessWaveCredits(4) * 2);
    expect(endlessWaveCredits(10)).toBeGreaterThan(endlessWaveCredits(9) * 2);
  });

  it('always returns positive integer', () => {
    for (let w = 1; w <= 50; w++) {
      const credits = endlessWaveCredits(w);
      expect(credits).toBeGreaterThan(0);
      expect(Number.isInteger(credits)).toBe(true);
    }
  });
});

describe('endlessWaveScore', () => {
  it('increases with wave number', () => {
    expect(endlessWaveScore(1)).toBeLessThan(endlessWaveScore(5));
    expect(endlessWaveScore(5)).toBeLessThan(endlessWaveScore(10));
  });

  it('boss waves give 3x score', () => {
    // wave 4: (100 + 4*40) * 1 = 260; wave 5: (100 + 5*40) * 3 = 900
    expect(endlessWaveScore(5)).toBeGreaterThan(endlessWaveScore(4) * 2);
  });

  it('always returns positive integer', () => {
    for (let w = 1; w <= 50; w++) {
      const score = endlessWaveScore(w);
      expect(score).toBeGreaterThan(0);
      expect(Number.isInteger(score)).toBe(true);
    }
  });
});
