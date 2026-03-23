import { describe, it, expect } from 'vitest';
import {
  createWingmanState,
  deployWingman,
  killWingman,
  updateWingmanTimers,
  computeWingmanAI,
  WINGMAN_RESPAWN_DELAY,
  WINGMAN_FOLLOW_DISTANCE,
  WINGMAN_ATTACK_RANGE,
  WINGMAN_MIN_RANGE,
} from '../src/game/wingman';
import type { WingmanConfig } from '../src/game/wingman';

const TEST_CONFIG: WingmanConfig = {
  blueprintId: 'test-bp-1',
  name: 'Test Wingman',
  color: '#60a5fa',
};

// ── State Management ─────────────────────────────────────────

describe('createWingmanState', () => {
  it('returns inactive state with no config', () => {
    const state = createWingmanState();
    expect(state.active).toBe(false);
    expect(state.config).toBeNull();
    expect(state.respawnTimer).toBe(0);
    expect(state.totalKills).toBe(0);
    expect(state.hpFraction).toBe(1);
    expect(state.targetId).toBeNull();
  });
});

describe('deployWingman', () => {
  it('activates the wingman with config', () => {
    const state = deployWingman(createWingmanState(), TEST_CONFIG);
    expect(state.active).toBe(true);
    expect(state.config).toEqual(TEST_CONFIG);
    expect(state.respawnTimer).toBe(0);
    expect(state.hpFraction).toBe(1);
    expect(state.fireTimer).toBe(0);
  });

  it('resets timers on deploy', () => {
    const state = createWingmanState();
    state.fireTimer = 5;
    state.respawnTimer = 3;
    const deployed = deployWingman(state, TEST_CONFIG);
    expect(deployed.fireTimer).toBe(0);
    expect(deployed.respawnTimer).toBe(0);
  });
});

describe('killWingman', () => {
  it('deactivates and sets respawn timer', () => {
    const deployed = deployWingman(createWingmanState(), TEST_CONFIG);
    const killed = killWingman(deployed);
    expect(killed.active).toBe(false);
    expect(killed.respawnTimer).toBe(WINGMAN_RESPAWN_DELAY);
    expect(killed.config).toEqual(TEST_CONFIG); // config persists
  });
});

describe('updateWingmanTimers', () => {
  it('does nothing when active', () => {
    const deployed = deployWingman(createWingmanState(), TEST_CONFIG);
    const result = updateWingmanTimers(deployed, 2);
    expect(result.active).toBe(true);
  });

  it('counts down respawn timer', () => {
    const killed = killWingman(deployWingman(createWingmanState(), TEST_CONFIG));
    const after1s = updateWingmanTimers(killed, 1);
    expect(after1s.respawnTimer).toBe(WINGMAN_RESPAWN_DELAY - 1);
    expect(after1s.active).toBe(false);
  });

  it('auto-respawns when timer hits zero', () => {
    const killed = killWingman(deployWingman(createWingmanState(), TEST_CONFIG));
    let state = killed;
    // Tick past respawn delay
    for (let i = 0; i < 10; i++) {
      state = updateWingmanTimers(state, 1);
    }
    expect(state.active).toBe(true);
    expect(state.hpFraction).toBe(1);
    expect(state.fireTimer).toBe(0);
  });

  it('does not respawn if no config', () => {
    const state = createWingmanState();
    state.respawnTimer = 2;
    const after = updateWingmanTimers(state, 3);
    expect(after.active).toBe(false);
  });
});

// ── AI Behavior ──────────────────────────────────────────────

describe('computeWingmanAI', () => {
  const BASE_INPUT = {
    playerX: 0,
    playerZ: 0,
    playerRotation: 0,
    wingmanX: 3,
    wingmanZ: 3,
    wingmanRotation: 0,
    enemyPositions: [] as Array<{ id: string; x: number; z: number; alive: boolean }>,
    wingmanFireInterval: 0.5,
  };

  it('follows player when no enemies exist', () => {
    const result = computeWingmanAI(BASE_INPUT);
    expect(result.shouldFire).toBe(false);
    expect(result.targetId).toBeNull();
    // Should be near the follow offset
    const dx = result.moveX - BASE_INPUT.wingmanX;
    const dz = result.moveZ - BASE_INPUT.wingmanZ;
    expect(Math.sqrt(dx * dx + dz * dz)).toBeGreaterThan(0);
  });

  it('follows player when enemies are out of range', () => {
    const result = computeWingmanAI({
      ...BASE_INPUT,
      enemyPositions: [{ id: 'e1', x: 100, z: 100, alive: true }],
    });
    expect(result.shouldFire).toBe(false);
    expect(result.targetId).toBeNull();
  });

  it('targets nearest enemy in range', () => {
    const result = computeWingmanAI({
      ...BASE_INPUT,
      wingmanX: 0,
      wingmanZ: 0,
      enemyPositions: [
        { id: 'far', x: 30, z: 0, alive: true },
        { id: 'near', x: 8, z: 0, alive: true },
      ],
    });
    expect(result.targetId).toBe('near');
    expect(result.shouldFire).toBe(true);
  });

  it('ignores dead enemies', () => {
    const result = computeWingmanAI({
      ...BASE_INPUT,
      wingmanX: 0,
      wingmanZ: 0,
      enemyPositions: [
        { id: 'dead', x: 5, z: 0, alive: false },
        { id: 'alive', x: 10, z: 0, alive: true },
      ],
    });
    expect(result.targetId).toBe('alive');
  });

  it('moves toward enemy when in attack range', () => {
    const result = computeWingmanAI({
      ...BASE_INPUT,
      wingmanX: 0,
      wingmanZ: 0,
      enemyPositions: [{ id: 'e1', x: 10, z: 0, alive: true }],
    });
    // Move target should be near the enemy
    const dist = Math.hypot(result.moveX - 10, result.moveZ);
    expect(dist).toBeLessThan(2);
  });

  it('backs away when too close to enemy', () => {
    const result = computeWingmanAI({
      ...BASE_INPUT,
      wingmanX: 0,
      wingmanZ: 0,
      enemyPositions: [{ id: 'e1', x: 1, z: 0, alive: true }],
    });
    // Should move away from enemy
    const dx = result.moveX - 1;  // direction from enemy
    expect(Math.abs(result.moveX - 0)).toBeGreaterThan(1); // moved away
  });

  it('follows at offset from player facing direction', () => {
    const result = computeWingmanAI({
      ...BASE_INPUT,
      playerRotation: 0,
      enemyPositions: [],
    });
    // Player facing 0 (north), offset at angle 0.4*PI from facing
    const distFromPlayer = Math.hypot(result.moveX, result.moveZ);
    // The offset should be non-zero (wingman doesn't sit on player)
    expect(distFromPlayer).toBeGreaterThan(0);
    // Should be at approximately WINGMAN_FOLLOW_DISTANCE from player origin
    expect(distFromPlayer).toBeCloseTo(WINGMAN_FOLLOW_DISTANCE, 0);
  });
});
