import { describe, expect, it } from 'vitest';
import type { ShipBlueprint } from '../src/core/types';
import { DEFAULT_CREW_ALLOCATION } from '../src/game/crew';
import { buildDroneBays, getDroneBayModules } from '../src/game/drones';

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
});
