import type { ShipBlueprint } from '../core/types';
import { cloneBlueprint } from '../state/shipBlueprint';

export interface HangarEntry {
  id: string;
  name: string;
  blueprint: ShipBlueprint;
  updatedAt: string;
}

function nextId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `hangar-${Math.random().toString(36).slice(2)}`;
}

export function createHangarEntry(name: string, blueprint: ShipBlueprint): HangarEntry {
  return {
    id: nextId(),
    name: name.trim() || blueprint.name,
    blueprint: cloneBlueprint(blueprint),
    updatedAt: new Date().toISOString(),
  };
}

export function saveBlueprintToHangar(entries: HangarEntry[], name: string, blueprint: ShipBlueprint): HangarEntry[] {
  return sortHangarEntries([...entries, createHangarEntry(name, blueprint)]);
}

export function renameHangarEntry(entries: HangarEntry[], id: string, name: string): HangarEntry[] {
  return entries.map((entry) => (
    entry.id === id
      ? { ...entry, name: name.trim() || entry.name, updatedAt: new Date().toISOString() }
      : entry
  ));
}

export function removeBlueprintFromHangar(entries: HangarEntry[], id: string): HangarEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

export function sortHangarEntries(entries: HangarEntry[]): HangarEntry[] {
  return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
