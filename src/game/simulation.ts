import type { DamageType } from '../core/types';

export interface DamageResult {
  shieldAbsorbed: number;
  hullDamage: number;
}

/**
 * Resolves raw damage through shield and armor layers.
 *
 * - Energy: fully blocked by shields; armor's energyVulnerability increases damage through armor.
 * - Kinetic: kineticBypass fraction passes through shields; reduced by armor normally.
 * - Explosive: 50% absorbed by shields; reduced by armor normally.
 * - armorPenetration reduces the effective armor rating.
 */
export function resolveDamage(
  rawDamage: number,
  damageType: DamageType,
  armorPenetration: number,
  currentShield: number,
  armorRating: number,
  kineticBypass: number,
  energyVulnerability: number,
): DamageResult {
  if (rawDamage <= 0) return { shieldAbsorbed: 0, hullDamage: 0 };

  // Step 1: Shield absorption
  let shieldFraction: number;
  if (currentShield <= 0) {
    shieldFraction = 0;
  } else if (damageType === 'kinetic') {
    shieldFraction = 1 - kineticBypass;
  } else if (damageType === 'explosive') {
    shieldFraction = 0.5;
  } else {
    shieldFraction = 1;
  }

  const shieldDamage = rawDamage * shieldFraction;
  const shieldAbsorbed = Math.min(shieldDamage, currentShield);
  const remaining = rawDamage - shieldAbsorbed;

  // Step 2: Armor reduction
  const effectiveArmor = Math.max(0, armorRating * (1 - armorPenetration));
  let armorReduction = effectiveArmor / (effectiveArmor + 50);

  if (damageType === 'energy') {
    armorReduction *= (1 - energyVulnerability);
  }

  const hullDamage = remaining * Math.max(0, 1 - armorReduction);

  return { shieldAbsorbed, hullDamage: Math.max(0, hullDamage) };
}

export function rechargeShield(currentShield: number, maxShield: number, rechargeRate: number, dt: number): number {
  if (maxShield <= 0 || rechargeRate <= 0) return currentShield;
  return Math.min(maxShield, currentShield + rechargeRate * dt);
}

export interface EncounterState {
  currentWave: number;
  totalWaves: number;
  remainingEnemies: number;
  playerAlive: boolean;
}

export interface EncounterProgress {
  nextWave: number;
  outcome: 'continue' | 'victory' | 'defeat';
  shouldSpawnWave: boolean;
}

const EMERGENCY_POWER_FLOOR = 0.35;

export function computePowerFactor(powerOutput: number, powerDemand: number): number {
  if (powerDemand <= 0) {
    return 1;
  }
  const ratio = powerOutput / powerDemand;
  return clamp(Math.max(EMERGENCY_POWER_FLOOR, ratio), EMERGENCY_POWER_FLOOR, 1);
}

export function computeCoolingPerSecond(baseCooling: number, powerFactor: number): number {
  return baseCooling * clamp(powerFactor, 0.7, 1.5);
}

export function isOverheated(currentHeat: number, heatCapacity: number): boolean {
  return currentHeat > heatCapacity;
}

export function getHeatStress(currentHeat: number, heatCapacity: number): number {
  if (heatCapacity <= 0) {
    return 0;
  }
  return clamp(currentHeat / heatCapacity, 0, 1.5);
}

export function getEffectiveThrust(
  baseThrust: number,
  powerFactor: number,
  currentHeat: number,
  heatCapacity: number,
): number {
  const heatPenalty = getHeatPenaltyMultiplier(currentHeat, heatCapacity);
  return round2(baseThrust * powerFactor * heatPenalty);
}

export function getEffectiveWeaponCadence(
  baseCadence: number,
  powerFactor: number,
  currentHeat: number,
  heatCapacity: number,
): number {
  const heatPenalty = getHeatPenaltyMultiplier(currentHeat, heatCapacity);
  return round2(baseCadence * powerFactor * heatPenalty);
}

export function coolHeat(
  currentHeat: number,
  baseCooling: number,
  powerFactor: number,
  dt: number,
): number {
  const cooling = computeCoolingPerSecond(baseCooling, powerFactor) * dt;
  return Math.max(0, currentHeat - cooling);
}

export function advanceEncounterState(state: EncounterState): EncounterProgress {
  if (!state.playerAlive) {
    return { nextWave: state.currentWave, outcome: 'defeat', shouldSpawnWave: false };
  }
  if (state.remainingEnemies > 0) {
    return { nextWave: state.currentWave, outcome: 'continue', shouldSpawnWave: false };
  }
  if (state.currentWave >= state.totalWaves) {
    return { nextWave: state.currentWave, outcome: 'victory', shouldSpawnWave: false };
  }
  return { nextWave: state.currentWave + 1, outcome: 'continue', shouldSpawnWave: true };
}

function getHeatPenaltyMultiplier(currentHeat: number, heatCapacity: number): number {
  const stress = getHeatStress(currentHeat, heatCapacity);
  if (stress <= 0.6) {
    return 1;
  }
  return lerp(1, 0.7, clamp((stress - 0.6) / 0.4, 0, 1));
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * clamp(alpha, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
