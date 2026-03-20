import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  advanceEffect,
  createBeamEffect,
  createImpactEffect,
  createExplosionEffect,
} from '../src/game/effects';

describe('combat effect helpers', () => {
  it('creates beam effects with short lifetimes', () => {
    const effect = createBeamEffect(new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(5, 0.4, 0), '#5eead4');
    expect(effect.kind).toBe('beam');
    expect(effect.ttl).toBeGreaterThan(0);
    expect(effect.ttl).toBeLessThan(0.35);
  });

  it('creates explosion effects with larger scale than impacts', () => {
    const impact = createImpactEffect(new THREE.Vector3(0, 0.4, 0), '#f59e0b');
    const explosion = createExplosionEffect(new THREE.Vector3(0, 0.4, 0), '#fb7185');
    expect(explosion.scale).toBeGreaterThan(impact.scale);
    expect(explosion.ttl).toBeGreaterThan(impact.ttl);
  });

  it('advances effects toward completion over time', () => {
    const effect = createImpactEffect(new THREE.Vector3(0, 0.4, 0), '#f59e0b');
    const halfway = advanceEffect(effect, effect.ttl / 2);
    expect(halfway.age).toBeGreaterThan(effect.age);
    expect(halfway.opacity).toBeLessThan(effect.opacity);
  });
});
