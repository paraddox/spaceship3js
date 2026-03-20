import type { CrewAllocation, HexCoord, ModuleDefinition, PlacedModule, ShipBlueprint, ShipStats } from '../core/types';
import { addHex, getNeighbors, hexKey, normalizeRotation, transformFootprint } from '../core/hex';
import { DEFAULT_CREW_ALLOCATION, clampCrewAllocation } from '../game/crew';
import { EXAMPLE_SCOUT_BLUEPRINT, MODULES_BY_ID } from '../data/moduleCatalog';

function nextInstanceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Math.random().toString(36).slice(2)}`;
}

function cloneCrewAllocation(crew?: CrewAllocation): CrewAllocation {
  return clampCrewAllocation(crew ?? DEFAULT_CREW_ALLOCATION);
}

export function cloneBlueprint(blueprint: ShipBlueprint): ShipBlueprint {
  return {
    name: blueprint.name,
    crew: cloneCrewAllocation(blueprint.crew),
    modules: blueprint.modules.map((module) => ({
      instanceId: module.instanceId,
      definitionId: module.definitionId,
      position: { ...module.position },
      rotation: module.rotation,
    })),
  };
}

export function createExampleBlueprint(): ShipBlueprint {
  return cloneBlueprint(EXAMPLE_SCOUT_BLUEPRINT);
}

export function getModuleDefinition(definitionId: string): ModuleDefinition {
  const module = MODULES_BY_ID[definitionId];
  if (!module) {
    throw new Error(`Unknown module definition: ${definitionId}`);
  }
  return module;
}

export function getWorldFootprint(module: PlacedModule): HexCoord[] {
  const definition = getModuleDefinition(module.definitionId);
  return transformFootprint(definition.footprint, module.rotation).map((hex) => addHex(hex, module.position));
}

export function getOccupiedHexes(blueprint: ShipBlueprint): Map<string, PlacedModule> {
  const occupied = new Map<string, PlacedModule>();
  for (const module of blueprint.modules) {
    for (const hex of getWorldFootprint(module)) {
      occupied.set(hexKey(hex), module);
    }
  }
  return occupied;
}

export function canPlaceModule(
  blueprint: ShipBlueprint,
  definitionId: string,
  position: HexCoord,
  rotation = 0,
): boolean {
  const definition = getModuleDefinition(definitionId);
  const occupied = getOccupiedHexes(blueprint);
  const preview: PlacedModule = {
    instanceId: 'preview',
    definitionId,
    position,
    rotation: normalizeRotation(rotation),
  };
  const worldFootprint = getWorldFootprint(preview);

  for (const hex of worldFootprint) {
    if (occupied.has(hexKey(hex))) {
      return false;
    }
  }

  if (blueprint.modules.length === 0) {
    return definition.category === 'bridge';
  }

  return worldFootprint.some((hex) => getNeighbors(hex).some((neighbor) => occupied.has(hexKey(neighbor))));
}

export function placeModule(
  blueprint: ShipBlueprint,
  definitionId: string,
  position: HexCoord,
  rotation = 0,
): ShipBlueprint {
  if (!canPlaceModule(blueprint, definitionId, position, rotation)) {
    return blueprint;
  }
  const next = cloneBlueprint(blueprint);
  next.modules.push({
    instanceId: nextInstanceId(),
    definitionId,
    position: { ...position },
    rotation: normalizeRotation(rotation),
  });
  return next;
}

export function removeModuleAtHex(blueprint: ShipBlueprint, hex: HexCoord): ShipBlueprint {
  const key = hexKey(hex);
  const next = cloneBlueprint(blueprint);
  next.modules = next.modules.filter((module) => !getWorldFootprint(module).some((cell) => hexKey(cell) === key));
  return next;
}

export function setCrewAllocation(blueprint: ShipBlueprint, crew: CrewAllocation): ShipBlueprint {
  const next = cloneBlueprint(blueprint);
  next.crew = cloneCrewAllocation(crew);
  return next;
}

export function getModuleAtHex(blueprint: ShipBlueprint, hex: HexCoord): PlacedModule | null {
  const key = hexKey(hex);
  return blueprint.modules.find((module) => getWorldFootprint(module).some((cell) => hexKey(cell) == key)) ?? null;
}

export function computeShipStats(blueprint: ShipBlueprint): ShipStats {
  const stats: ShipStats = {
    mass: 0,
    maxHp: 0,
    powerOutput: 0,
    powerDemand: 0,
    powerBalance: 1,
    heatCapacity: 0,
    cooling: 0,
    engineCount: 0,
    weaponCount: 0,
    thrust: 0,
    damagePerVolley: 0,
    shotsPerSecond: 0,
    weaponRange: 0,
    heatPerVolley: 0,
  };

  for (const placed of blueprint.modules) {
    const def = getModuleDefinition(placed.definitionId);
    stats.mass += def.mass;
    stats.maxHp += def.maxHp;
    stats.powerOutput += def.powerOutput ?? 0;
    stats.powerDemand += def.powerConsumption ?? 0;
    stats.heatCapacity += def.heatCapacity;
    stats.cooling += def.heatDissipation ?? 0;

    if (def.category === 'engine') {
      stats.engineCount += 1;
      stats.thrust += Number(def.stats.thrust ?? 0);
    }

    if (def.category === 'weapon') {
      stats.weaponCount += 1;
      stats.damagePerVolley += Number(def.stats.damage ?? def.stats.damagePerSecond ?? 0);
      stats.shotsPerSecond += Number(def.stats.fireRate ?? 0.4);
      stats.weaponRange = Math.max(stats.weaponRange, Number(def.stats.range ?? def.stats.beamRange ?? 0));
      stats.heatPerVolley += Number(def.stats.heatPerShot ?? def.stats.heatPerSecond ?? 0);
    }
  }

  stats.powerBalance = stats.powerDemand > 0 ? stats.powerOutput / stats.powerDemand : 1;
  return stats;
}

export function serializeBlueprint(blueprint: ShipBlueprint): string {
  return JSON.stringify(blueprint, null, 2);
}

export function parseBlueprint(text: string): ShipBlueprint | null {
  try {
    const data = JSON.parse(text) as Partial<ShipBlueprint>;
    if (!data || typeof data !== 'object' || !Array.isArray(data.modules)) {
      return null;
    }
    return {
      name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Imported Ship',
      crew: cloneCrewAllocation(data.crew),
      modules: data.modules.map((module) => ({
        instanceId: typeof module.instanceId === 'string' ? module.instanceId : nextInstanceId(),
        definitionId: String(module.definitionId),
        position: { q: Number(module.position?.q ?? 0), r: Number(module.position?.r ?? 0) },
        rotation: normalizeRotation(Number(module.rotation ?? 0)),
      })),
    };
  } catch {
    return null;
  }
}
