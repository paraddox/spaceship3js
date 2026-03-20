import { describe, expect, it } from 'vitest';
import {
  createDroneInstances,
  chooseDroneTarget,
  advanceDrone,
  type DroneRuntimeState,
} from '../src/game/drone-runtime';
import { buildDroneProfiles } from '../src/game/drones';
import type { ShipBlueprint } from '../src/core/types';
import { DEFAULT_CREW_ALLOCATION } from '../src/game/crew';

const CARRIER: ShipBlueprint = {
  name: 'Carrier Scout',
  crew: { ...DEFAULT_CREW_ALLOCATION },
  modules: [
    { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'r1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
    { instanceId: 'd1', definitionId: 'core:light_drone_bay', position: { q: -1, r: 0 }, rotation: 0 },
  ],
};

describe('drone runtime helpers', () => {
  it('creates runtime drone instances from profiles', () => {
    const drones = createDroneInstances(buildDroneProfiles(CARRIER), { x: 0, z: 0 });
    expect(drones).toHaveLength(2);
    expect(drones[0]?.orbitAngle).not.toBe(drones[1]?.orbitAngle);
  });

  it('chooses the nearest target within range', () => {
    const drone: DroneRuntimeState = {
      id: 'd1-1',
      parentModuleId: 'd1',
      x: 0,
      z: 0,
      orbitRadius: 2,
      orbitAngle: 0,
      damage: 8,
      range: 240,
      cooldown: 0,
      fireRate: 0.8,
      team: 'player',
      hp: 20,
      active: true,
    };
    const target = chooseDroneTarget(drone, [
      { id: 'enemy-a', x: 10, z: 0, team: 'enemy', alive: true },
      { id: 'enemy-b', x: 5, z: 0, team: 'enemy', alive: true },
    ]);
    expect(target?.id).toBe('enemy-b');
  });

  it('advances drones around their parent anchor', () => {
    const drone: DroneRuntimeState = {
      id: 'd1-1',
      parentModuleId: 'd1',
      x: 0,
      z: 0,
      orbitRadius: 2,
      orbitAngle: 0,
      damage: 8,
      range: 240,
      cooldown: 0,
      fireRate: 0.8,
      team: 'player',
      hp: 20,
      active: true,
    };
    const next = advanceDrone(drone, { x: 4, z: 4 }, 0.5);
    expect(next.x).not.toBe(0);
    expect(next.z).not.toBe(0);
    expect(next.cooldown).toBe(0);
  });
});
