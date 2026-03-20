import { describe, expect, it } from 'vitest';
import { createExampleBlueprint } from '../src/state/shipBlueprint';
import {
  buildWeaponLoadout,
  getWeaponArchetype,
  type WeaponArchetype,
} from '../src/game/weapons';
import type { ShipBlueprint } from '../src/core/types';
import { DEFAULT_CREW_ALLOCATION } from '../src/game/crew';

describe('weapon archetype helpers', () => {
  it('classifies known weapon ids into their expected archetypes', () => {
    expect(getWeaponArchetype('core:laser_light')).toBe('laser');
    expect(getWeaponArchetype('core:cannon_kinetic')).toBe('projectile');
    expect(getWeaponArchetype('core:missile_launcher')).toBe('missile');
    expect(getWeaponArchetype('core:laser_beam_light')).toBe('beam');
  });

  it('builds a loadout for the example scout', () => {
    const loadout = buildWeaponLoadout(createExampleBlueprint());
    expect(loadout).toHaveLength(1);
    expect(loadout[0]?.archetype).toBe('laser');
    expect(loadout[0]?.range).toBeGreaterThan(300);
  });

  it('builds mixed loadouts for multi-weapon ships', () => {
    const blueprint: ShipBlueprint = {
      name: 'Mixed Arms',
      crew: { ...DEFAULT_CREW_ALLOCATION },
      modules: [
        { instanceId: 'b1', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
        { instanceId: 'r1', definitionId: 'core:reactor_medium', position: { q: 1, r: 0 }, rotation: 0 },
        { instanceId: 'w1', definitionId: 'core:laser_light', position: { q: 0, r: -1 }, rotation: 0 },
        { instanceId: 'w2', definitionId: 'core:cannon_kinetic', position: { q: -1, r: 0 }, rotation: 0 },
        { instanceId: 'w3', definitionId: 'core:missile_launcher', position: { q: 0, r: 1 }, rotation: 0 },
        { instanceId: 'w4', definitionId: 'core:laser_beam_light', position: { q: -1, r: 1 }, rotation: 0 },
      ],
    };

    const loadout = buildWeaponLoadout(blueprint);
    expect(loadout.map((weapon) => weapon.archetype)).toEqual<WeaponArchetype[]>([
      'laser',
      'projectile',
      'missile',
      'beam',
    ]);
    expect(loadout[2]?.cooldown).toBeGreaterThan(loadout[0]?.cooldown ?? 0);
    expect(loadout[2]?.projectileSpeed).toBeLessThan(loadout[1]?.projectileSpeed ?? Infinity);
    expect(loadout[3]?.projectileSpeed).toBe(0);
  });
});
