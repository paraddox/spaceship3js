import { describe, expect, it } from 'vitest';
import {
  ENCOUNTER_PRESETS,
  getEncounterPreset,
} from '../src/game/encounters';

describe('encounter presets', () => {
  it('exposes a broader scenario catalog', () => {
    expect(ENCOUNTER_PRESETS.length).toBeGreaterThanOrEqual(6);
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

  it('includes hazard-heavy nebula scenarios beyond the starter set', () => {
    const crossfire = getEncounterPreset('crossfire');
    const holdout = getEncounterPreset('holdout');
    expect(crossfire?.waves).toHaveLength(2);
    expect(crossfire?.waves.flatMap((wave) => wave.hazards).filter((hazard) => hazard.kind === 'damage_nebula').length).toBeGreaterThanOrEqual(3);
    expect(holdout?.objective.type).toBe('survive');
    expect(holdout?.objective.durationSeconds).toBeGreaterThanOrEqual(60);
  });

  it('includes explicit objective metadata for presets', () => {
    const gauntlet = getEncounterPreset('gauntlet');
    const survival = getEncounterPreset('survival');
    const escort = getEncounterPreset('escort');
    expect(gauntlet?.objective.type).toBe('eliminate_all');
    expect(survival?.objective.type).toBe('survive');
    expect(survival?.objective.durationSeconds).toBeGreaterThan(0);
    expect(escort?.objective.type).toBe('protect_ally');
  });

  it('returns undefined for unknown presets', () => {
    expect(getEncounterPreset('missing-preset')).toBeUndefined();
  });
});
