import { describe, expect, it } from 'vitest';
import { buildEncounterDebrief } from '../src/game/debrief';

describe('encounter debrief summaries', () => {
  it('builds a victory debrief with rewards', () => {
    const report = buildEncounterDebrief({
      encounterName: 'Frontier Gauntlet',
      objectiveLabel: 'Destroy all hostile ships',
      outcome: 'victory',
      creditsEarned: 220,
      bestScore: 1800,
      elapsedSeconds: 63,
    });

    expect(report.title).toMatch(/Victory/i);
    expect(report.lines.some((line) => line.includes('220'))).toBe(true);
    expect(report.lines.some((line) => line.includes('1:03'))).toBe(true);
  });

  it('builds a defeat debrief without reward language', () => {
    const report = buildEncounterDebrief({
      encounterName: 'Convoy Escort',
      objectiveLabel: 'Protect the convoy ship',
      outcome: 'defeat',
      creditsEarned: 0,
      bestScore: 700,
      elapsedSeconds: 18,
    });

    expect(report.title).toMatch(/Defeat/i);
    expect(report.lines.some((line) => /credits/i.test(line))).toBe(false);
  });
});
