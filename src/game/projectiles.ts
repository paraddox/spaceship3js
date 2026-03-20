import * as THREE from 'three';

const PROJECTILE_HEIGHT = 0.42;

export function computeProjectileSpawnPosition(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  shipRadius: number,
): THREE.Vector3 {
  const spawn = origin.clone().add(direction.clone().setY(0).normalize().multiplyScalar(shipRadius * 0.4));
  spawn.y = PROJECTILE_HEIGHT;
  return spawn;
}
