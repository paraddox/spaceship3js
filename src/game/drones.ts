import type { PlacedModule, ShipBlueprint } from '../core/types';
import { getModuleDefinition } from '../state/shipBlueprint';

export interface DroneBayState {
  module: PlacedModule;
  capacity: number;
  cooldown: number;
  droneDamage: number;
  droneRange: number;
}

export interface DroneProfile {
  id: string;
  parentModuleId: string;
  damage: number;
  orbitRadius: number;
  range: number;
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

export function buildDroneProfiles(blueprint: ShipBlueprint): DroneProfile[] {
  return buildDroneBays(blueprint).flatMap((bay) =>
    Array.from({ length: bay.capacity }, (_, index) => ({
      id: `${bay.module.instanceId}-drone-${index + 1}`,
      parentModuleId: bay.module.instanceId,
      damage: bay.droneDamage,
      orbitRadius: 1.3 + index * 0.45,
      range: bay.droneRange,
    })),
  );
}
