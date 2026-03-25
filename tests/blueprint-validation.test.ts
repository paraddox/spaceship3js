import { beforeEach, describe, expect, it } from 'vitest';
import type { ShipBlueprint } from '../src/core/types';
import {
  createExampleBlueprint,
  computeShipStats,
  getBlueprintValidation,
  getModuleDefinition,
  isBlueprintLaunchReady,
} from '../src/state/shipBlueprint';
import { DEFAULT_CREW_ALLOCATION } from '../src/game/crew';

const localStorageMock: Storage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; },
    get length() { return Object.keys(store).length; },
    key(_: number) { return null; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
}

beforeEach(() => {
  localStorageMock.clear();
});

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

  it('resolves corrupted lineage modules from local storage', () => {
    const baseWeapon = getModuleDefinition('core:laser_light');
    const corruptedDefinition = {
      ...baseWeapon,
      id: 'lineage:laser_light:test',
      displayName: 'Aggressive Light Laser',
      maxHp: baseWeapon.maxHp + 20,
      stats: {
        ...baseWeapon.stats,
        damage: Number(baseWeapon.stats.damage ?? 0) + 8,
      },
    };
    localStorageMock.setItem('spachip3js.lineage', JSON.stringify({
      modules: [{
        id: corruptedDefinition.id,
        baseModuleId: baseWeapon.id,
        displayName: corruptedDefinition.displayName,
        category: corruptedDefinition.category,
        footprint: corruptedDefinition.footprint,
        definition: corruptedDefinition,
        sourceAffix: 'Aggressive',
        sourceColor: '#f97316',
        wasBoss: false,
        waveNumber: 7,
        extractedAt: Date.now(),
      }],
    }));

    expect(getModuleDefinition(corruptedDefinition.id).displayName).toBe('Aggressive Light Laser');

    const blueprint: ShipBlueprint = {
      name: 'Corrupted Ship',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'r1', definitionId: 'core:reactor_small', position: { q: 1, r: 0 }, rotation: 0 },
        { instanceId: 'e1', definitionId: 'core:thruster_small', position: { q: -1, r: 0 }, rotation: 0 },
        { instanceId: 'w1', definitionId: corruptedDefinition.id, position: { q: 0, r: -1 }, rotation: 0 },
      ],
    };

    const stats = computeShipStats(blueprint);
    expect(stats.weaponCount).toBe(1);
    expect(stats.maxHp).toBeGreaterThan(baseWeapon.maxHp);
    expect(isBlueprintLaunchReady(blueprint)).toBe(true);
  });
});
