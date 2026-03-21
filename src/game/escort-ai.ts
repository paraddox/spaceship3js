export interface EscortPoint {
  x: number;
  z: number;
}

export interface ProtectedAllyState extends EscortPoint {
  speed: number;
}

export interface PriorityTarget extends EscortPoint {
  id: string;
}

export function computeEscortProgress(
  origin: EscortPoint,
  current: EscortPoint,
  extractionPoint: EscortPoint,
): number {
  const pathX = extractionPoint.x - origin.x;
  const pathZ = extractionPoint.z - origin.z;
  const fullDistanceSquared = pathX * pathX + pathZ * pathZ;
  if (fullDistanceSquared <= 0.001) {
    return 1;
  }

  const traveledX = current.x - origin.x;
  const traveledZ = current.z - origin.z;
  const projectedDistance = (traveledX * pathX + traveledZ * pathZ) / Math.sqrt(fullDistanceSquared);
  const fullDistance = Math.sqrt(fullDistanceSquared);
  return Math.max(0, Math.min(1, projectedDistance / fullDistance));
}

export function advanceProtectedAlly(
  ally: ProtectedAllyState,
  extractionPoint: EscortPoint,
  dt: number,
): ProtectedAllyState {
  if (dt <= 0 || ally.speed <= 0) {
    return ally;
  }

  const dx = extractionPoint.x - ally.x;
  const dz = extractionPoint.z - ally.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.001) {
    return ally;
  }

  const step = Math.min(distance, ally.speed * dt);
  const nx = dx / distance;
  const nz = dz / distance;

  return {
    ...ally,
    x: ally.x + nx * step,
    z: ally.z + nz * step,
  };
}

export function chooseEnemyPriorityTarget(
  enemy: EscortPoint,
  player: PriorityTarget,
  protectedAlly: PriorityTarget | null,
): PriorityTarget {
  if (!protectedAlly) {
    return player;
  }

  const playerDistance = Math.hypot(player.x - enemy.x, player.z - enemy.z);
  const allyDistance = Math.hypot(protectedAlly.x - enemy.x, protectedAlly.z - enemy.z);

  return allyDistance < playerDistance ? protectedAlly : player;
}
