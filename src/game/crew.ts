import type { CrewAllocation, ShipStats } from '../core/types';

export interface CrewModifiers {
  thrustMultiplier: number;
  turnMultiplier: number;
  damageMultiplier: number;
  fireRateMultiplier: number;
  coolingMultiplier: number;
  powerStabilityBonus: number;
  rangeMultiplier: number;
  targetingAssist: number;
}

export const DEFAULT_CREW_ALLOCATION: CrewAllocation = {
  pilot: 1,
  gunner: 1,
  engineer: 1,
  tactician: 1,
};

const PILOT_THRUST_TABLE = [1, 1.1, 1.2, 1.24, 1.28, 1.3];
const PILOT_TURN_TABLE = [1, 1.08, 1.16, 1.21, 1.25, 1.28];
const GUNNER_DAMAGE_TABLE = [1, 1.08, 1.16, 1.18, 1.2, 1.22];
const GUNNER_FIRE_TABLE = [1, 1.1, 1.2, 1.21, 1.22, 1.23];
const ENGINEER_COOLING_TABLE = [1, 1.12, 1.24, 1.3, 1.35, 1.4];
const RANGE_TABLE = [1, 1.06, 1.12, 1.18, 1.22, 1.26];

export function clampCrewAllocation(allocation: CrewAllocation): CrewAllocation {
  return {
    pilot: Math.max(0, Math.floor(allocation.pilot || 0)),
    gunner: Math.max(0, Math.floor(allocation.gunner || 0)),
    engineer: Math.max(0, Math.floor(allocation.engineer || 0)),
    tactician: Math.max(0, Math.floor(allocation.tactician || 0)),
  };
}

export function computeCrewModifiers(allocation: CrewAllocation): CrewModifiers {
  const crew = clampCrewAllocation(allocation);
  return {
    thrustMultiplier: tableValue(PILOT_THRUST_TABLE, crew.pilot),
    turnMultiplier: tableValue(PILOT_TURN_TABLE, crew.pilot),
    damageMultiplier: tableValue(GUNNER_DAMAGE_TABLE, crew.gunner),
    fireRateMultiplier: tableValue(GUNNER_FIRE_TABLE, crew.gunner),
    coolingMultiplier: tableValue(ENGINEER_COOLING_TABLE, crew.engineer),
    powerStabilityBonus: round2(crew.engineer * 0.06),
    rangeMultiplier: tableValue(RANGE_TABLE, crew.tactician),
    targetingAssist: round2(crew.tactician * 0.07),
  };
}

export function applyCrewModifiers(stats: ShipStats, allocation: CrewAllocation): ShipStats {
  const modifiers = computeCrewModifiers(allocation);
  return {
    ...stats,
    thrust: stats.thrust * modifiers.thrustMultiplier,
    damagePerVolley: stats.damagePerVolley * modifiers.damageMultiplier,
    shotsPerSecond: stats.shotsPerSecond * modifiers.fireRateMultiplier,
    cooling: stats.cooling * modifiers.coolingMultiplier,
    powerBalance: stats.powerBalance + modifiers.powerStabilityBonus,
    weaponRange: stats.weaponRange * modifiers.rangeMultiplier,
  };
}

function tableValue(table: number[], points: number): number {
  return table[Math.min(points, table.length - 1)] ?? table[table.length - 1] ?? 1;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
