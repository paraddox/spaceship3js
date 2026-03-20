import type { PlacedModule, ShipBlueprint } from '../core/types';
import { getModuleDefinition } from '../state/shipBlueprint';

export interface DroneBayState {
  module: PlacedModule;
  capacity: number;
  cooldown: number;
  droneDamage: number;
  droneRange: number;
}

export function getDroneBayModules(blueprint: ShipBlueprint): PlacedModule[] {
  return blueprint.modules.filter((module) => getModuleDefinition(module.definitionId).category === 'drone_bay');
}

export function buildDroneBays(blueprint: ShipBlueprint): DroneBayState[] {
  return getDroneBayModules(blueprint).map((module) => {
    const definition = getModuleDefinition(module.definitionId);
    return {
      module,
      capacity: Number(definition.stats.capacity ?? 1),
      cooldown: Number(definition.stats.launchCooldown ?? 3),
      droneDamage: Number(definition.stats.droneDamage ?? 8),
      droneRange: Number(definition.stats.droneRange ?? 240),
    };
  });
}
