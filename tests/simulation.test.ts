import { describe, expect, it } from 'vitest';
import {
  computePowerFactor,
  computeCoolingPerSecond,
  getEffectiveThrust,
  getEffectiveWeaponCadence,
  isOverheated,
  advanceEncounterState,
  type EncounterState,
} from '../src/game/simulation';

describe('ship simulation helpers', () => {
  it('keeps full output when ship has enough power', () => {
    expect(computePowerFactor(50, 20)).toBe(1);
  });

  it('reduces output when demand is higher than output', () => {
    expect(computePowerFactor(20, 40)).toBeCloseTo(0.5, 4);
  });

  it('never drops below the emergency floor when there is some demand', () => {
    expect(computePowerFactor(0, 80)).toBeCloseTo(0.35, 4);
  });

  it('boosts cooling when ship has power surplus', () => {
    expect(computeCoolingPerSecond(0.4, 1.5)).toBeCloseTo(0.6, 4);
  });

  it('thrust is reduced by both power deficit and overheating', () => {
    expect(getEffectiveThrust(100, 0.5, 60, 50)).toBeCloseTo(35, 4);
  });

  it('weapon cadence drops under power deficit and heavy heat', () => {
    expect(getEffectiveWeaponCadence(2, 0.5, 55, 50)).toBeCloseTo(0.7, 4);
  });

  it('marks ships as overheated only after capacity is exceeded', () => {
    expect(isOverheated(49.9, 50)).toBe(false);
    expect(isOverheated(50.1, 50)).toBe(true);
  });
});

describe('encounter progression', () => {
  it('requests the next wave when the current wave is cleared', () => {
    const state: EncounterState = {
      currentWave: 1,
      totalWaves: 3,
      remainingEnemies: 0,
      playerAlive: true,
    };

    expect(advanceEncounterState(state)).toEqual({
      nextWave: 2,
      outcome: 'continue',
      shouldSpawnWave: true,
    });
  });

  it('declares victory after the last wave is cleared', () => {
    const state: EncounterState = {
      currentWave: 3,
      totalWaves: 3,
      remainingEnemies: 0,
      playerAlive: true,
    };

    expect(advanceEncounterState(state)).toEqual({
      nextWave: 3,
      outcome: 'victory',
      shouldSpawnWave: false,
    });
  });

  it('declares defeat when the player ship is destroyed', () => {
    const state: EncounterState = {
      currentWave: 1,
      totalWaves: 3,
      remainingEnemies: 2,
      playerAlive: false,
    };

    expect(advanceEncounterState(state)).toEqual({
      nextWave: 1,
      outcome: 'defeat',
      shouldSpawnWave: false,
    });
  });
});
