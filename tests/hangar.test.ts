import { describe, expect, it } from 'vitest';
import { createExampleBlueprint } from '../src/state/shipBlueprint';
import {
  createHangarEntry,
  saveBlueprintToHangar,
  removeBlueprintFromHangar,
  renameHangarEntry,
  sortHangarEntries,
  type HangarEntry,
} from '../src/game/hangar';

describe('hangar model', () => {
  it('creates a named hangar entry from a blueprint', () => {
    const blueprint = createExampleBlueprint();
    const entry = createHangarEntry('Scout Alpha Mk I', blueprint);
    expect(entry.name).toBe('Scout Alpha Mk I');
    expect(entry.blueprint.name).toBe('Scout Alpha');
    expect(entry.id).toBeTruthy();
  });

  it('adds a blueprint to the hangar and keeps existing entries', () => {
    const entries: HangarEntry[] = [createHangarEntry('Slot A', createExampleBlueprint())];
    const next = saveBlueprintToHangar(entries, 'Slot B', createExampleBlueprint());
    expect(next).toHaveLength(2);
    expect(next.map((entry) => entry.name)).toContain('Slot A');
    expect(next.map((entry) => entry.name)).toContain('Slot B');
  });

  it('renames a hangar entry without mutating other slots', () => {
    const first = createHangarEntry('Alpha', createExampleBlueprint());
    const second = createHangarEntry('Beta', createExampleBlueprint());
    const next = renameHangarEntry([first, second], first.id, 'Alpha Prime');
    expect(next.find((entry) => entry.id === first.id)?.name).toBe('Alpha Prime');
    expect(next.find((entry) => entry.id === second.id)?.name).toBe('Beta');
  });

  it('removes a hangar entry by id', () => {
    const first = createHangarEntry('Alpha', createExampleBlueprint());
    const second = createHangarEntry('Beta', createExampleBlueprint());
    const next = removeBlueprintFromHangar([first, second], first.id);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe(second.id);
  });

  it('sorts newer hangar entries ahead of older ones', () => {
    const older = { ...createHangarEntry('Older', createExampleBlueprint()), updatedAt: '2024-01-01T00:00:00.000Z' };
    const newer = { ...createHangarEntry('Newer', createExampleBlueprint()), updatedAt: '2025-01-01T00:00:00.000Z' };
    const sorted = sortHangarEntries([older, newer]);
    expect(sorted[0]?.name).toBe('Newer');
    expect(sorted[1]?.name).toBe('Older');
  });
});
