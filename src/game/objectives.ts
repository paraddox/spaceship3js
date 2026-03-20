export type ObjectiveResult = 'continue' | 'victory' | 'defeat';

export interface EncounterObjective {
  type: 'eliminate_all' | 'survive' | 'protect_ally';
  label: string;
  durationSeconds?: number;
}

export interface ObjectiveRuntimeState {
  elapsedSeconds: number;
  remainingEnemies: number;
  playerAlive: boolean;
  protectedAlive?: boolean;
}

export function evaluateObjective(
  objective: EncounterObjective,
  state: ObjectiveRuntimeState,
): ObjectiveResult {
  if (!state.playerAlive) {
    return 'defeat';
  }

  if (objective.type === 'survive') {
    return state.elapsedSeconds >= (objective.durationSeconds ?? 0) ? 'victory' : 'continue';
  }

  if (objective.type === 'protect_ally') {
    if (state.protectedAlive === false) {
      return 'defeat';
    }
    return state.remainingEnemies <= 0 ? 'victory' : 'continue';
  }

  return state.remainingEnemies <= 0 ? 'victory' : 'continue';
}
