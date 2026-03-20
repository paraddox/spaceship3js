import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { computeProjectileSpawnPosition } from '../src/game/projectiles';

describe('projectile spawn positioning', () => {
  it('spawns projectiles above the arena plane so they remain visible', () => {
    const origin = new THREE.Vector3(2, 0, -3);
    const direction = new THREE.Vector3(1, 0, 0).normalize();
    const spawn = computeProjectileSpawnPosition(origin, direction, 4);

    expect(spawn.y).toBeGreaterThan(0);
  });

  it('offsets the spawn point forward from the firing ship', () => {
    const origin = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3(0, 0, 1).normalize();
    const spawn = computeProjectileSpawnPosition(origin, direction, 5);

    expect(spawn.z).toBeGreaterThan(0);
    expect(spawn.distanceTo(origin)).toBeGreaterThan(0);
  });
});
