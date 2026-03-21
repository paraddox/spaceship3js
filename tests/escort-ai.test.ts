import { describe, expect, it } from 'vitest';
import { advanceProtectedAlly, chooseEnemyPriorityTarget, computeEscortProgress } from '../src/game/escort-ai';

describe('escort mission helpers', () => {
  it('tracks extraction progress from escort origin to extraction point', () => {
    expect(computeEscortProgress({ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: -10 })).toBe(0);
    expect(computeEscortProgress({ x: 0, z: 0 }, { x: 0, z: -5 }, { x: 0, z: -10 })).toBe(0.5);
    expect(computeEscortProgress({ x: 0, z: 0 }, { x: 0, z: -12 }, { x: 0, z: -10 })).toBe(1);
  });

  it('moves the protected ally toward its extraction point', () => {
    const next = advanceProtectedAlly(
      { x: 0, z: 0, speed: 4 },
      { x: 0, z: -10 },
      0.5,
    );

    expect(next.z).toBeLessThan(0);
  });

  it('prefers attacking the protected ally when it is closer than the player', () => {
    const target = chooseEnemyPriorityTarget(
      { x: 0, z: -8 },
      { id: 'player', x: 0, z: 6 },
      { id: 'ally', x: 0, z: -2 },
    );

    expect(target.id).toBe('ally');
  });

  it('keeps targeting the player if the convoy ship is not present', () => {
    const target = chooseEnemyPriorityTarget(
      { x: 0, z: -8 },
      { id: 'player', x: 0, z: 6 },
      null,
    );

    expect(target.id).toBe('player');
  });
});
