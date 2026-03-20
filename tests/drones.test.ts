import { describe, expect, it } from 'vitest';
import type { ShipBlueprint } from '../src/core/types';
import { DEFAULT_CREW_ALLOCATION } from '../src/game/crew';
import { buildDroneBays, buildDroneProfiles, getDroneBayModules } from '../src/game/drones';
import { computeShipStats } from '../src/state/shipBlueprint';

describe('drone support helpers', () => {
  it('finds drone bay modules in a blueprint', () => {
    const blueprint: ShipBlueprint = {
      name: 'Carrier Scout',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'r1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
        { instanceId: 'd1', definitionId: 'core:light_drone_bay', position: { q: -1, r: 0 }, rotation: 0 },
      ],
    };
    expect(getDroneBayModules(blueprint)).toHaveLength(1);
  });

  it('builds drone bay state from module stats', () => {
    const blueprint: ShipBlueprint = {
      name: 'Carrier Scout',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'r1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
        { instanceId: 'd1', definitionId: 'core:light_drone_bay', position: { q: -1, r: 0 }, rotation: 0 },
      ],
    };
    const bays = buildDroneBays(blueprint);
    expect(bays[0]?.capacity).toBe(2);
    expect(bays[0]?.cooldown).toBeGreaterThan(0);
    expect(bays[0]?.droneDamage).toBeGreaterThan(0);
  });

  it('expands drone bays into concrete drone profiles', () => {
    const blueprint: ShipBlueprint = {
      name: 'Carrier Scout',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'r1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
        { instanceId: 'd1', definitionId: 'core:light_drone_bay', position: { q: -1, r: 0 }, rotation: 0 },
      ],
    };
    const drones = buildDroneProfiles(blueprint);
    expect(drones).toHaveLength(2);
    expect(drones[0]?.parentModuleId).toBe('d1');
    expect(drones[0]?.damage).toBeGreaterThan(0);
    expect(drones[0]?.orbitRadius).toBeGreaterThan(0);
  });

  it('adds drone metrics into aggregate ship stats', () => {
    const blueprint: ShipBlueprint = {
      name: 'Carrier Scout',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'r1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
        { instanceId: 'd1', definitionId: 'core:light_drone_bay', position: { q: -1, r: 0 }, rotation: 0 },
      ],
    };
    const stats = computeShipStats(blueprint);
    expect(stats.droneBayCount).toBe(1);
    expect(stats.droneCapacity).toBe(2);
  });
});
