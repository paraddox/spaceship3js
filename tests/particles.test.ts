import { describe, it, expect } from 'vitest';
import { ParticleSystem, createScreenShake, updateScreenShake } from '../src/game/particles';
import * as THREE from 'three';

describe('ParticleSystem', () => {
  it('creates pool with correct size and all inactive', () => {
    const system = new ParticleSystem();
    let activeCount = 0;
    for (const p of (system as unknown as { pool: Array<{ active: boolean }> }).pool) {
      if (p.active) activeCount++;
    }
    expect(activeCount).toBe(0);
    system.dispose();
  });

  it('emits particles from config', () => {
    const system = new ParticleSystem();
    system.emit(ParticleSystem.hitSpark(new THREE.Vector3(1, 0, 2)));

    let activeCount = 0;
    for (const p of (system as unknown as { pool: Array<{ active: boolean }> }).pool) {
      if (p.active) activeCount++;
    }
    expect(activeCount).toBe(6); // hitSpark count
    system.dispose();
  });

  it('particle lifetimes decrease with update', () => {
    const system = new ParticleSystem();
    system.emit(ParticleSystem.hitSpark(new THREE.Vector3(0, 0, 0)));

    const pool = (system as unknown as { pool: Array<{ life: number; maxLife: number }> }).pool;
    const initialLives = pool.filter((p) => p.active).map((p) => p.life);

    system.update(0.1);

    const updatedLives = pool.filter((p) => p.active).map((p) => p.life);
    for (let i = 0; i < updatedLives.length; i++) {
      expect(updatedLives[i]).toBeLessThan(initialLives[i]);
    }
    system.dispose();
  });

  it('particles deactivate after lifetime expires', () => {
    const system = new ParticleSystem();
    // Emit with very short life
    system.emit({
      position: new THREE.Vector3(0, 0, 0),
      count: 3,
      speed: [0, 0],
      life: [0.01, 0.01],
      startScale: [0.2, 0.2],
      color: '#ffffff',
    });

    system.update(0.05);

    let activeCount = 0;
    for (const p of (system as unknown as { pool: Array<{ active: boolean }> }).pool) {
      if (p.active) activeCount++;
    }
    expect(activeCount).toBe(0);
    system.dispose();
  });

  it('death explosion returns multiple configs', () => {
    const configs = ParticleSystem.deathExplosion(new THREE.Vector3(0, 0, 0));
    expect(configs.length).toBe(3);
    const totalCount = configs.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBe(62); // 30 + 20 + 12
  });

  it('clear deactivates all particles', () => {
    const system = new ParticleSystem();
    system.emit(ParticleSystem.hitSpark(new THREE.Vector3(0, 0, 0)));
    system.emit(ParticleSystem.hitSpark(new THREE.Vector3(0, 0, 0)));

    system.clear();

    let activeCount = 0;
    for (const p of (system as unknown as { pool: Array<{ active: boolean }> }).pool) {
      if (p.active) activeCount++;
    }
    expect(activeCount).toBe(0);
    system.dispose();
  });

  it('gracefully handles pool exhaustion', () => {
    const system = new ParticleSystem();
    // Try to emit more than pool size
    for (let i = 0; i < 500; i++) {
      system.emit(ParticleSystem.hitSpark(new THREE.Vector3(0, 0, 0)));
    }
    // Should not crash, pool just caps
    let activeCount = 0;
    for (const p of (system as unknown as { pool: Array<{ active: boolean }> }).pool) {
      if (p.active) activeCount++;
    }
    expect(activeCount).toBeLessThanOrEqual(400);
    system.dispose();
  });

  it('directional emission creates particles in the right hemisphere', () => {
    const system = new ParticleSystem();
    const dir = new THREE.Vector3(0, 0, -1); // emit backward
    system.emit(ParticleSystem.thrustTrail(new THREE.Vector3(0, 0, 0), dir, false));

    const pool = (system as unknown as { pool: Array<{ active: boolean; velocity: THREE.Vector3 }> }).pool;
    const active = pool.filter((p) => p.active);
    expect(active.length).toBe(1);
    // Velocity should be roughly in +Z direction (opposite of -Z dir)
    expect(active[0].velocity.z).toBeGreaterThan(0);
    system.dispose();
  });
});

describe('Screen Shake', () => {
  it('creates shake state with correct values', () => {
    const shake = createScreenShake(0.5, 0.3, 25);
    expect(shake.intensity).toBe(0.5);
    expect(shake.duration).toBe(0.3);
    expect(shake.remaining).toBe(0.3);
    expect(shake.frequency).toBe(25);
  });

  it('decrements remaining time', () => {
    const shake = createScreenShake(0.5, 0.3);
    const camera = new THREE.OrthographicCamera(-14, 14, 14, -14, 0.1, 120);
    const basePos = new THREE.Vector3(0, 20, 0);

    updateScreenShake(shake, camera, basePos, 0.1);
    expect(shake.remaining).toBeCloseTo(0.2);
  });

  it('resets camera position when shake expires', () => {
    const shake = createScreenShake(0.5, 0.05);
    const camera = new THREE.OrthographicCamera(-14, 14, 14, -14, 0.1, 120);
    const basePos = new THREE.Vector3(5, 20, 10);

    updateScreenShake(shake, camera, basePos, 0.1);
    expect(shake.remaining).toBeLessThanOrEqual(0);
    expect(camera.position.x).toBeCloseTo(basePos.x);
    expect(camera.position.z).toBeCloseTo(basePos.z);
  });
});
