export interface ProgressionState {
  credits: number;
  completedEncounterIds: string[];
  bestEncounterScores: Record<string, number>;
  unlockedModuleIds: string[];
}

export interface EncounterReward {
  credits: number;
  score: number;
  victory: boolean;
}

import { DEFAULT_UNLOCKED_MODULE_IDS } from './unlocks';

export const DEFAULT_PROGRESSION_STATE: ProgressionState = {
  credits: 0,
  completedEncounterIds: [],
  bestEncounterScores: {},
  unlockedModuleIds: [...DEFAULT_UNLOCKED_MODULE_IDS],
};

export function createEncounterReward(waveCount: number, enemyCount: number, victory: boolean): EncounterReward {
  const score = waveCount * 500 + enemyCount * 120 + (victory ? 350 : 0);
  const credits = waveCount * 60 + enemyCount * 18 + (victory ? 100 : 0);
  return { credits, score, victory };
}

export function applyEncounterReward(
  state: ProgressionState,
  encounterId: string,
  reward: EncounterReward,
): ProgressionState {
  const next = markEncounterCompleted(state, encounterId);
  return {
    credits: next.credits + reward.credits,
    completedEncounterIds: next.completedEncounterIds,
    bestEncounterScores: {
      ...next.bestEncounterScores,
      [encounterId]: Math.max(next.bestEncounterScores[encounterId] ?? 0, reward.score),
    },
    unlockedModuleIds: next.unlockedModuleIds,
  };
}

export function markEncounterCompleted(state: ProgressionState, encounterId: string): ProgressionState {
  return {
    ...state,
    completedEncounterIds: state.completedEncounterIds.includes(encounterId)
      ? state.completedEncounterIds
      : [...state.completedEncounterIds, encounterId],
  };
}
