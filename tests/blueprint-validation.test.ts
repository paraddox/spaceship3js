import { describe, expect, it } from 'vitest';
import type { ShipBlueprint } from '../src/core/types';
import {
  createExampleBlueprint,
  getBlueprintValidation,
  isBlueprintLaunchReady,
} from '../src/state/shipBlueprint';
import { DEFAULT_CREW_ALLOCATION } from '../src/game/crew';

describe('blueprint validation', () => {
  it('accepts the example scout as launch-ready', () => {
    const blueprint = createExampleBlueprint();
    expect(isBlueprintLaunchReady(blueprint)).toBe(true);
  });

  it('requires at least one bridge module', () => {
    const blueprint: ShipBlueprint = {
      name: 'No Bridge',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'h1', definitionId: 'core:hull_1x1', position: { q: 0, r: 0 }, rotation: 0 },
      ],
    };

    const validation = getBlueprintValidation(blueprint);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain('Ship requires a bridge module.');
  });

  it('rejects disconnected module islands', () => {
    const blueprint: ShipBlueprint = {
      name: 'Island Ship',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'r1', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
        { instanceId: 'w1', definitionId: 'core:laser_light', position: { q: 5, r: 0 }, rotation: 0 },
      ],
    };

    const validation = getBlueprintValidation(blueprint);
    expect(validation.valid).toBe(false);
    expect(validation.disconnectedModuleIds).toEqual(['w1']);
  });

  it('requires enough power output before launch', () => {
    const blueprint: ShipBlueprint = {
      name: 'Brownout Ship',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'w1', definitionId: 'core:laser_light', position: { q: 0, r: -1 }, rotation: 0 },
        { instanceId: 'w2', definitionId: 'core:cannon_kinetic', position: { q: 0, r: 1 }, rotation: 0 },
      ],
    };

    const validation = getBlueprintValidation(blueprint);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContain('Ship needs enough power output before launch.');
  });
});
