import { describe, expect, it } from 'vitest';
import { evaluateObjective, type EncounterObjective } from '../src/game/objectives';

describe('encounter objectives', () => {
  it('wins eliminate-all objectives when no enemies remain', () => {
    const objective: EncounterObjective = { type: 'eliminate_all', label: 'Destroy all hostiles' };
    expect(evaluateObjective(objective, { elapsedSeconds: 10, remainingEnemies: 0, playerAlive: true })).toBe('victory');
  });

  it('keeps eliminate-all objectives running while enemies remain', () => {
    const objective: EncounterObjective = { type: 'eliminate_all', label: 'Destroy all hostiles' };
    expect(evaluateObjective(objective, { elapsedSeconds: 10, remainingEnemies: 2, playerAlive: true })).toBe('continue');
  });

  it('wins survival objectives after the timer expires', () => {
    const objective: EncounterObjective = { type: 'survive', label: 'Survive the ambush', durationSeconds: 45 };
    expect(evaluateObjective(objective, { elapsedSeconds: 46, remainingEnemies: 5, playerAlive: true })).toBe('victory');
  });

  it('fails any objective when the player is destroyed', () => {
    const objective: EncounterObjective = { type: 'survive', label: 'Survive the ambush', durationSeconds: 45 };
    expect(evaluateObjective(objective, { elapsedSeconds: 5, remainingEnemies: 5, playerAlive: false })).toBe('defeat');
  });

  it('fails protect-ally objectives when the protected ship is destroyed', () => {
    const objective: EncounterObjective = { type: 'protect_ally', label: 'Protect the convoy ship' };
    expect(evaluateObjective(objective, { elapsedSeconds: 12, remainingEnemies: 2, playerAlive: true, protectedAlive: false })).toBe('defeat');
  });

  it('wins protect-ally objectives once hostiles are cleared and the ally survives', () => {
    const objective: EncounterObjective = { type: 'protect_ally', label: 'Protect the convoy ship' };
    expect(evaluateObjective(objective, { elapsedSeconds: 30, remainingEnemies: 0, playerAlive: true, protectedAlive: true })).toBe('victory');
  });
});
