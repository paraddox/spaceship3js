export type ModuleCategory = 'bridge' | 'hull' | 'reactor' | 'engine' | 'weapon' | 'drone_bay' | 'shield' | 'armor';

export type DamageType = 'energy' | 'kinetic' | 'explosive';

export interface HexCoord {
  q: number;
  r: number;
}

export interface ModuleDefinition {
  id: string;
  displayName: string;
  description: string;
  category: ModuleCategory;
  footprint: HexCoord[];
  mass: number;
  maxHp: number;
  heatCapacity: number;
  heatDissipation?: number;
  powerOutput?: number;
  powerConsumption?: number;
  color: string;
  stats: Record<string, number | string | boolean>;
}

export interface PlacedModule {
  instanceId: string;
  definitionId: string;
  position: HexCoord;
  rotation: number;
}

export interface CrewAllocation {
  pilot: number;
  gunner: number;
  engineer: number;
  tactician: number;
}

export interface ShipBlueprint {
  name: string;
  modules: PlacedModule[];
  crew: CrewAllocation;
}

export interface ShipStats {
  mass: number;
  maxHp: number;
  powerOutput: number;
  powerDemand: number;
  powerBalance: number;
  heatCapacity: number;
  cooling: number;
  engineCount: number;
  weaponCount: number;
  droneBayCount: number;
  droneCapacity: number;
  thrust: number;
  damagePerVolley: number;
  shotsPerSecond: number;
  weaponRange: number;
  heatPerVolley: number;
  shieldStrength: number;
  shieldRecharge: number;
  armorRating: number;
  kineticBypass: number;
  energyVulnerability: number;
}
