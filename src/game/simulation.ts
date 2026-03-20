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
