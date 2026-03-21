import type { ProgressionState } from './progression';

export const DEFAULT_UNLOCKED_MODULE_IDS = [
  'core:bridge_scout',
  'core:hull_1x1',
  'core:reactor_small',
  'core:thruster_small',
  'core:laser_light',
] as const;

export const MODULE_UNLOCK_COSTS: Record<string, number> = {
  'core:bridge_frigate': 220,
  'core:hull_2x1': 90,
  'core:reactor_medium': 180,
  'core:reactor_large': 400,
  'core:thruster_lateral': 120,
  'core:cannon_kinetic': 110,
  'core:cannon_heavy': 350,
  'core:missile_launcher': 260,
  'core:laser_beam_light': 240,
  'core:light_drone_bay': 300,
  'core:shield_generator': 280,
  'core:armor_plating': 150,
};

export function isModuleUnlocked(state: ProgressionState, moduleId: string): boolean {
  return state.unlockedModuleIds.includes(moduleId);
}

export function canUnlockModule(state: ProgressionState, moduleId: string): boolean {
  if (isModuleUnlocked(state, moduleId)) return false;
  const cost = MODULE_UNLOCK_COSTS[moduleId] ?? 0;
  return cost > 0 && state.credits >= cost;
}

export function unlockModule(state: ProgressionState, moduleId: string): ProgressionState {
  if (isModuleUnlocked(state, moduleId)) return state;
  const cost = MODULE_UNLOCK_COSTS[moduleId] ?? 0;
  if (cost <= 0 || state.credits < cost) return state;
  return {
    ...state,
    credits: state.credits - cost,
    unlockedModuleIds: [...state.unlockedModuleIds, moduleId],
  };
}
