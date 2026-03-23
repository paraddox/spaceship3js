import { describe, expect, it } from 'vitest';
import {
  createNemesisFromCandidate,
  createNemesisState,
  getNemesisReward,
  injectNemesisIntoWave,
  recordNemesisDefeat,
  recordNemesisVictory,
  shouldSpawnNemesis,
} from '../src/game/nemesis';
import type { ShipBlueprint } from '../src/core/types';
import type { EncounterWave } from '../src/game/encounters';
import * as THREE from 'three';

const BLUEPRINT: ShipBlueprint = {
  name: 'Raider Scout',
  crew: { pilot: 1, gunner: 1, engineer: 1, tactician: 1 },
  modules: [
    { instanceId: 'bridge', definitionId: 'core:bridge_scout', position: { q: 0, r: 0 }, rotation: 0 },
    { instanceId: 'weapon', definitionId: 'core:laser_light', position: { q: 1, r: 0 }, rotation: 0 },
  ],
};

describe('nemesis system', () => {
  it('creates a nemesis from a candidate only when none exists', () => {
    const state = createNemesisFromCandidate(createNemesisState(), {
      blueprint: BLUEPRINT,
      waveNumber: 7,
      isBoss: false,
    });
    expect(state.active?.callsign).toContain('Raider Scout');
    expect(state.active?.killsPlayer).toBe(1);
    expect(createNemesisFromCandidate(state, { blueprint: BLUEPRINT, waveNumber: 8, isBoss: true })).toBe(state);
  });

  it('spawns on its scheduled recurrence cadence', () => {
    const state = createNemesisFromCandidate(createNemesisState(), {
      blueprint: BLUEPRINT,
      waveNumber: 6,
      isBoss: false,
    });
    expect(shouldSpawnNemesis(state, 8)).toBe(true);
    expect(shouldSpawnNemesis(state, 9)).toBe(false);
    expect(shouldSpawnNemesis(state, 12)).toBe(true);
  });

  it('injects a nemesis enemy into a wave', () => {
    const state = createNemesisFromCandidate(createNemesisState(), {
      blueprint: BLUEPRINT,
      waveNumber: 6,
      isBoss: false,
    });
    const wave: EncounterWave = {
      name: 'Skirmish 8',
      enemies: [
        {
          id: 'enemy-a',
          blueprint: BLUEPRINT,
          position: new THREE.Vector3(0, 0, 0),
          rotation: 0,
          preferredRange: 8,
          fireJitter: 0.3,
          affixes: [],
        },
      ],
    };
    const injected = injectNemesisIntoWave(state, wave, 8);
    expect(injected.name).toContain('Nemesis');
    expect(injected.enemies[0].nemesisProfileId).toBe(state.active?.id);
    expect(injected.enemies[0].blueprint.name).toBe(state.active?.callsign);
    expect((injected.enemies[0].affixes?.length ?? 0)).toBeGreaterThan(0);
  });

  it('tracks victories and defeats and retires after three defeats', () => {
    const state = createNemesisFromCandidate(createNemesisState(), {
      blueprint: BLUEPRINT,
      waveNumber: 6,
      isBoss: false,
    });
    const afterVictory = recordNemesisVictory(state, 9);
    expect(afterVictory.active?.killsPlayer).toBe(2);
    expect(afterVictory.active?.level).toBeGreaterThan(state.active?.level ?? 0);

    const one = recordNemesisDefeat(afterVictory, 10);
    const two = recordNemesisDefeat(one, 14);
    const retired = recordNemesisDefeat(two, 18);
    expect(retired.active).toBe(null);
    expect(retired.archiveCount).toBe(1);
  });

  it('scales rewards with level', () => {
    const low = getNemesisReward(1);
    const high = getNemesisReward(5);
    expect(high.credits).toBeGreaterThan(low.credits);
    expect(high.score).toBeGreaterThan(low.score);
  });
});
