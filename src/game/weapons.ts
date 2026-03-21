import type { ShipBlueprint } from '../core/types';
import { getModuleDefinition } from '../state/shipBlueprint';

export type WeaponArchetype = 'laser' | 'projectile' | 'missile' | 'beam';

export interface WeaponProfile {
  definitionId: string;
  archetype: WeaponArchetype;
  damage: number;
  range: number;
  cooldown: number;
  heat: number;
  projectileSpeed: number;
  spread: number;
  damageType: string;
  armorPenetration: number;
}

export function getWeaponArchetype(definitionId: string): WeaponArchetype {
  if (definitionId.includes('missile')) return 'missile';
  if (definitionId.includes('beam')) return 'beam';
  if (definitionId.includes('laser')) return 'laser';
  return 'projectile';
}

export function buildWeaponLoadout(blueprint: ShipBlueprint): WeaponProfile[] {
  return blueprint.modules
    .map((module) => {
      const definition = getModuleDefinition(module.definitionId);
      if (definition.category !== 'weapon') return null;
      return createWeaponProfile(module.definitionId, definition.stats);
    })
    .filter((weapon): weapon is WeaponProfile => weapon !== null);
}

function createWeaponProfile(definitionId: string, stats: Record<string, number | string | boolean>): WeaponProfile {
  const archetype = getWeaponArchetype(definitionId);
  const fireRate = Number(stats.fireRate ?? 0.5);
  const damage = Number(stats.damage ?? stats.damagePerSecond ?? 0);
  const range = Number(stats.range ?? stats.beamRange ?? 300);
  const heat = Number(stats.heatPerShot ?? stats.heatPerSecond ?? 4);
  const damageType = String(stats.damageType ?? 'kinetic');
  const armorPenetration = Number(stats.armorPenetration ?? 0);

  if (archetype === 'missile') {
    return {
      definitionId, archetype, damage, range,
      cooldown: 1 / Math.max(fireRate, 0.15), heat,
      projectileSpeed: Number(stats.projectileSpeed ?? 10), spread: 0.03,
      damageType, armorPenetration,
    };
  }

  if (archetype === 'beam') {
    return {
      definitionId, archetype, damage, range,
      cooldown: 0.18, heat,
      projectileSpeed: 0, spread: 0,
      damageType, armorPenetration,
    };
  }

  if (archetype === 'laser') {
    return {
      definitionId, archetype, damage, range,
      cooldown: 1 / Math.max(fireRate, 0.25), heat,
      projectileSpeed: Number(stats.projectileSpeed ?? 20), spread: 0.01,
      damageType, armorPenetration,
    };
  }

  return {
    definitionId, archetype, damage, range,
    cooldown: 1 / Math.max(fireRate, 0.2), heat,
    projectileSpeed: Number(stats.projectileSpeed ?? 14), spread: 0.02,
    damageType, armorPenetration,
  };
}
