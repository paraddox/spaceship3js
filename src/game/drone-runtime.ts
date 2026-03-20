import type { DroneProfile } from './drones';

export interface DroneRuntimeState {
  id: string;
  parentModuleId: string;
  x: number;
  z: number;
  orbitRadius: number;
  orbitAngle: number;
  damage: number;
  range: number;
  cooldown: number;
  fireRate: number;
  team: 'player' | 'enemy';
  hp: number;
  active: boolean;
}

export interface DroneTarget {
  id: string;
  x: number;
  z: number;
  team: 'player' | 'enemy';
  alive: boolean;
}

export function createDroneInstances(
  profiles: DroneProfile[],
  anchor: { x: number; z: number },
  team: 'player' | 'enemy' = 'player',
): DroneRuntimeState[] {
  return profiles.map((profile, index) => ({
    id: profile.id,
    parentModuleId: profile.parentModuleId,
    x: anchor.x,
    z: anchor.z,
    orbitRadius: profile.orbitRadius,
    orbitAngle: (Math.PI * 2 * index) / Math.max(1, profiles.length),
    damage: profile.damage,
    range: profile.range,
    cooldown: 0,
    fireRate: 0.8,
    team,
    hp: 20,
    active: true,
  }));
}

export function chooseDroneTarget(drone: DroneRuntimeState, candidates: DroneTarget[]): DroneTarget | null {
  let best: DroneTarget | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (!candidate.alive || candidate.team === drone.team) continue;
    const distance = Math.hypot(candidate.x - drone.x, candidate.z - drone.z);
    if (distance > drone.range / 30) continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function advanceDrone(
  drone: DroneRuntimeState,
  anchor: { x: number; z: number },
  dt: number,
): DroneRuntimeState {
  const orbitAngle = drone.orbitAngle + dt * 1.8;
  return {
    ...drone,
    orbitAngle,
    x: anchor.x + Math.cos(orbitAngle) * drone.orbitRadius,
    z: anchor.z + Math.sin(orbitAngle) * drone.orbitRadius,
    cooldown: Math.max(0, drone.cooldown - dt),
  };
}
