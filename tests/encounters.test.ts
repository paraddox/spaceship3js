import { describe, expect, it } from 'vitest';
import {
  ENCOUNTER_PRESETS,
  getEncounterPreset,
} from '../src/game/encounters';

describe('encounter presets', () => {
  it('exposes multiple scenario presets', () => {
    expect(ENCOUNTER_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('includes a default gauntlet scenario with three waves', () => {
    const gauntlet = getEncounterPreset('gauntlet');
    expect(gauntlet?.waves).toHaveLength(3);
    expect(gauntlet?.displayName).toMatch(/Gauntlet/i);
  });

  it('includes a beam-focused enemy somewhere in the catalog', () => {
    const allEnemyModuleIds = ENCOUNTER_PRESETS.flatMap((preset) =>
      preset.waves.flatMap((wave) =>
        wave.enemies.flatMap((enemy) => enemy.blueprint.modules.map((module) => module.definitionId)),
      ),
    );
    expect(allEnemyModuleIds).toContain('core:laser_beam_light');
  });

  it('includes at least one carrier-style drone encounter', () => {
    const allEnemyModuleIds = ENCOUNTER_PRESETS.flatMap((preset) =>
      preset.waves.flatMap((wave) =>
        wave.enemies.flatMap((enemy) => enemy.blueprint.modules.map((module) => module.definitionId)),
      ),
    );
    expect(allEnemyModuleIds).toContain('core:light_drone_bay');
  });

  it('includes explicit objective metadata for presets', () => {
    const gauntlet = getEncounterPreset('gauntlet');
    const survival = getEncounterPreset('survival');
    expect(gauntlet?.objective.type).toBe('eliminate_all');
    expect(survival?.objective.type).toBe('survive');
    expect(survival?.objective.durationSeconds).toBeGreaterThan(0);
  });

  it('returns undefined for unknown presets', () => {
    expect(getEncounterPreset('missing-preset')).toBeUndefined();
  });
});
