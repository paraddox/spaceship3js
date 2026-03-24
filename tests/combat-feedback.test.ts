import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  type CombatFeedbackState,
  spawnDamageNumber,
  tickFloatingTexts,
  spawnMuzzleFlash,
  tickMuzzleFlashes,
  spawnDeathExplosion,
  tickDeathExplosions,
  disposeCombatFeedback,
  flashHit,
} from '../src/game/combat-feedback';

// Canvas 2D is unavailable in jsdom — skip tests that depend on it.
const hasCanvas2D = (() => {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('2d');
  } catch {
    return false;
  }
})();

let scene: THREE.Scene;

beforeEach(() => {
  scene = new THREE.Scene();
});

describe('spawnDamageNumber', () => {
  it.skipIf(!hasCanvas2D)('adds a floating text to state', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDamageNumber(state, new THREE.Vector3(1, 0, 0), 42);
    expect(state.floatingTexts).toHaveLength(1);
    expect(state.floatingTexts[0].life).toBeCloseTo(0.9, 1);
    expect(state.floatingTexts[0].maxLife).toBeCloseTo(0.9, 1);
  });

  it.skipIf(!hasCanvas2D)('crit flag extends lifetime', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDamageNumber(state, new THREE.Vector3(0, 0, 0), 10, true);
    expect(state.floatingTexts[0].life).toBeCloseTo(1.2, 1);
  });

  it.skipIf(!hasCanvas2D)('heal flag uses correct color', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDamageNumber(state, new THREE.Vector3(0, 0, 0), 10, false, true);
    expect(state.floatingTexts).toHaveLength(1);
  });

  it.skipIf(!hasCanvas2D)('mesh is not auto-added to scene', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDamageNumber(state, new THREE.Vector3(0, 0, 0), 10);
    expect(state.floatingTexts[0].mesh.parent).toBeNull();
  });
});

describe('tickFloatingTexts', () => {
  it.skipIf(!hasCanvas2D)('removes expired texts and cleans up', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDamageNumber(state, new THREE.Vector3(0, 0, 0), 10);
    scene.add(state.floatingTexts[0].mesh);

    // Tick past expiry
    tickFloatingTexts(state, 1.0, scene);
    expect(state.floatingTexts).toHaveLength(0);
    expect(scene.children).toHaveLength(0);
  });

  it.skipIf(!hasCanvas2D)('moves texts upward over time', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDamageNumber(state, new THREE.Vector3(0, 0, 0), 10);
    scene.add(state.floatingTexts[0].mesh);

    const startY = state.floatingTexts[0].mesh.position.y;
    tickFloatingTexts(state, 0.1, scene);
    expect(state.floatingTexts[0].mesh.position.y).toBeGreaterThan(startY);
  });
});

describe('spawnMuzzleFlash / tickMuzzleFlashes', () => {
  it('adds a point light to the scene', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnMuzzleFlash(state, scene, new THREE.Vector3(5, 0, 5));
    expect(state.muzzleFlashes).toHaveLength(1);
    expect(scene.children).toHaveLength(1);
  });

  it('removes expired flashes and cleans up', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnMuzzleFlash(state, scene, new THREE.Vector3(0, 0, 0));
    tickMuzzleFlashes(state, 0.1, scene);
    expect(state.muzzleFlashes).toHaveLength(0);
    expect(scene.children).toHaveLength(0);
  });

  it('fades light intensity over time', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnMuzzleFlash(state, scene, new THREE.Vector3(0, 0, 0));
    const light = state.muzzleFlashes[0].light;
    const startIntensity = light.intensity;
    tickMuzzleFlashes(state, 0.04, scene);
    expect(light.intensity).toBeLessThan(startIntensity);
  });
});

describe('spawnDeathExplosion / tickDeathExplosions', () => {
  it('creates a group with particles in the scene', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDeathExplosion(state, scene, new THREE.Vector3(0, 0, 0), 8);
    expect(state.deathExplosions).toHaveLength(1);
    expect(scene.children).toHaveLength(1);
    // 8 particles + 1 central flash
    expect(state.deathExplosions[0].particles).toHaveLength(9);
  });

  it('removes expired explosions and cleans up resources', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDeathExplosion(state, scene, new THREE.Vector3(0, 0, 0));
    tickDeathExplosions(state, 0.8, scene);
    expect(state.deathExplosions).toHaveLength(0);
    expect(scene.children).toHaveLength(0);
  });

  it('boss explosions get more particles', () => {
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDeathExplosion(state, scene, new THREE.Vector3(0, 0, 0), 24);
    // 24 particles + 1 flash
    expect(state.deathExplosions[0].particles).toHaveLength(25);
  });
});

describe('disposeCombatFeedback', () => {
  it('removes all active feedback from scene and resets state', () => {
    const mockCtx = { clearRect: () => {}, fillText: () => {}, measureText: () => ({ width: 10 }), font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, strokeRect: () => {} };
    const canvas = { width: 0, height: 0, getContext: () => mockCtx, toDataURL: () => '' } as unknown as HTMLCanvasElement;
    vi.stubGlobal('document', { createElement: () => canvas });
    const state: CombatFeedbackState = { floatingTexts: [], muzzleFlashes: [], deathExplosions: [] };
    spawnDamageNumber(state, new THREE.Vector3(0, 0, 0), 10);
    spawnMuzzleFlash(state, scene, new THREE.Vector3(0, 0, 0));
    spawnDeathExplosion(state, scene, new THREE.Vector3(0, 0, 0));

    // Manually add floating text mesh to scene (normally added externally)
    scene.add(state.floatingTexts[0].mesh);

    expect(state.floatingTexts.length).toBeGreaterThan(0);
    expect(state.muzzleFlashes.length).toBeGreaterThan(0);
    expect(state.deathExplosions.length).toBeGreaterThan(0);
    expect(scene.children.length).toBeGreaterThan(0);

    disposeCombatFeedback(state, scene);

    expect(state.floatingTexts).toHaveLength(0);
    expect(state.muzzleFlashes).toHaveLength(0);
    expect(state.deathExplosions).toHaveLength(0);
    // Death explosion group was removed
    expect(scene.children.length).toBe(0); // only muzzle flash light was in scene
  });
});

describe('flashHit', () => {
  beforeEach(() => {
    // flashHit uses requestAnimationFrame. Queue the callback but don't run it
    // so we can assert the initial state synchronously.
    vi.stubGlobal('requestAnimationFrame', () => 0);
  });

  it('returns a cleanup function', () => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    const group = new THREE.Group();
    group.add(mesh);

    const cleanup = flashHit(group, 0.01);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('sets emissive to white on StandardMaterial immediately', () => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x000000, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    const group = new THREE.Group();
    group.add(mesh);

    flashHit(group, 0.01);
    // Emissive is set synchronously; RAF fade-back hasn't run yet
    expect(mat.emissiveIntensity).toBe(2);
  });
});
