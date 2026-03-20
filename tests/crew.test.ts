import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CREW_ALLOCATION,
  applyCrewModifiers,
  clampCrewAllocation,
  computeCrewModifiers,
} from '../src/game/crew';
import type { CrewAllocation, ShipStats } from '../src/core/types';

const BASE_STATS: ShipStats = {
  mass: 20,
  maxHp: 300,
  powerOutput: 30,
  powerDemand: 20,
  powerBalance: 1.5,
  heatCapacity: 80,
  cooling: 0.4,
  engineCount: 2,
  weaponCount: 2,
  thrust: 120,
  damagePerVolley: 40,
  shotsPerSecond: 1.2,
  weaponRange: 500,
  heatPerVolley: 10,
};

describe('crew allocation helpers', () => {
  it('exposes a stable default crew allocation', () => {
    expect(DEFAULT_CREW_ALLOCATION).toEqual({ pilot: 1, gunner: 1, engineer: 1, tactician: 1 });
  });

  it('clamps negative crew values to zero', () => {
    expect(clampCrewAllocation({ pilot: -2, gunner: 3, engineer: 0, tactician: 1 })).toEqual({
      pilot: 0,
      gunner: 3,
      engineer: 0,
      tactician: 1,
    });
  });

  it('computes stronger thrust and handling from pilot crew', () => {
    const modifiers = computeCrewModifiers({ pilot: 3, gunner: 0, engineer: 0, tactician: 0 });
    expect(modifiers.thrustMultiplier).toBeCloseTo(1.24, 4);
    expect(modifiers.turnMultiplier).toBeCloseTo(1.21, 4);
  });

  it('computes stronger weapon performance from gunner crew', () => {
    const modifiers = computeCrewModifiers({ pilot: 0, gunner: 3, engineer: 0, tactician: 0 });
    expect(modifiers.damageMultiplier).toBeCloseTo(1.18, 4);
    expect(modifiers.fireRateMultiplier).toBeCloseTo(1.21, 4);
  });

  it('computes better cooling and power stability from engineer crew', () => {
    const modifiers = computeCrewModifiers({ pilot: 0, gunner: 0, engineer: 3, tactician: 0 });
    expect(modifiers.coolingMultiplier).toBeCloseTo(1.3, 4);
    expect(modifiers.powerStabilityBonus).toBeCloseTo(0.18, 4);
  });

  it('computes better range and targeting from tactician crew', () => {
    const modifiers = computeCrewModifiers({ pilot: 0, gunner: 0, engineer: 0, tactician: 3 });
    expect(modifiers.rangeMultiplier).toBeCloseTo(1.18, 4);
    expect(modifiers.targetingAssist).toBeCloseTo(0.21, 4);
  });
});

describe('crew modifiers on ship stats', () => {
  it('applies pilot and gunner bonuses to ship performance', () => {
    const crew: CrewAllocation = { pilot: 2, gunner: 2, engineer: 0, tactician: 0 };
    const modified = applyCrewModifiers(BASE_STATS, crew);

    expect(modified.thrust).toBeCloseTo(144, 4);
    expect(modified.damagePerVolley).toBeCloseTo(46.4, 4);
    expect(modified.shotsPerSecond).toBeCloseTo(1.44, 4);
  });

  it('applies engineer and tactician bonuses to support stats', () => {
    const crew: CrewAllocation = { pilot: 0, gunner: 0, engineer: 2, tactician: 2 };
    const modified = applyCrewModifiers(BASE_STATS, crew);

    expect(modified.cooling).toBeCloseTo(0.496, 4);
    expect(modified.powerBalance).toBeCloseTo(1.62, 4);
    expect(modified.weaponRange).toBeCloseTo(560, 4);
  });
});
