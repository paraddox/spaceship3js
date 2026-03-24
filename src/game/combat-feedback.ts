import * as THREE from 'three';

// ── Public Types ───────────────────────────────────────────

export interface FloatingText {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface MuzzleFlash {
  light: THREE.PointLight;
  life: number;
}

export interface DeathExplosion {
  group: THREE.Group;
  particles: THREE.Mesh[];
  life: number;
}

export interface CombatFeedbackState {
  floatingTexts: FloatingText[];
  muzzleFlashes: MuzzleFlash[];
  deathExplosions: DeathExplosion[];
}

// ── Hit Flash ──────────────────────────────────────────────

/**
 * Flash a ship's material emissive color white for `duration` seconds,
 * then fade back to its original emissive.
 *
 * @returns a cleanup function that immediately resets the material.
 */
export function flashHit(
  group: THREE.Object3D,
  duration = 0.1,
): () => void {
  const originals = new Map<THREE.Mesh, { color: THREE.Color; intensity: number }>();
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
        originals.set(mesh, {
          color: mat.emissive.clone(),
          intensity: mat.emissiveIntensity,
        });
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = 2;
      }
    }
  });

  let cancelled = false;
  const startTime = performance.now();

  function fadeBack() {
    if (cancelled) return;
    const elapsed = (performance.now() - startTime) / 1000;
    if (elapsed >= duration) {
      reset();
      return;
    }
    const t = elapsed / duration;
    const flash = 1 - t;
    originals.forEach((orig, mesh) => {
      const mat = mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
        mat.emissiveIntensity = orig.intensity + (2 - orig.intensity) * flash;
      }
    });
    requestAnimationFrame(fadeBack);
  }

  function reset() {
    cancelled = true;
    originals.forEach((orig, mesh) => {
      const mat = mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
        mat.emissive.copy(orig.color);
        mat.emissiveIntensity = orig.intensity;
      }
    });
  }

  requestAnimationFrame(fadeBack);
  return reset;
}

// ── Floating Damage Numbers ────────────────────────────────

const TEXT_SHARED_GEO = new THREE.PlaneGeometry(0.5, 0.5);
const TEXT_SHARED_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  depthTest: false,
  side: THREE.DoubleSide,
});

/**
 * Create a floating damage number at `worldPos`.
 * It drifts upward and fades over `duration` seconds.
 */
export function spawnDamageNumber(
  state: CombatFeedbackState,
  worldPos: THREE.Vector3,
  amount: number,
  crit = false,
  isHeal = false,
): void {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);

  const label = isHeal
    ? `+${Math.round(amount)}`
    : `${Math.round(amount)}`;
  const fontSize = crit ? 72 : amount > 20 ? 56 : 44;
  ctx.font = `900 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isHeal) {
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#22c55e';
  } else if (crit) {
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#94a3b8';
  }
  ctx.shadowBlur = 8;
  ctx.fillText(label, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = TEXT_SHARED_MAT.clone();
  mat.map = texture;
  mat.color = new THREE.Color(0xffffff);

  const mesh = new THREE.Mesh(TEXT_SHARED_GEO, mat);
  mesh.position.set(
    worldPos.x + (Math.random() - 0.5) * 0.3,
    worldPos.y + 0.3,
    worldPos.z + (Math.random() - 0.5) * 0.3,
  );
  mesh.rotation.x = -Math.PI * 0.15;
  if (crit) mesh.scale.set(1.3, 1.3, 1);

  const duration = crit ? 1.2 : 0.9;
  state.floatingTexts.push({
    mesh,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      1.5 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.3,
    ),
    life: duration,
    maxLife: duration,
  });
}

/** Update all floating texts. Call once per frame. */
export function tickFloatingTexts(
  state: CombatFeedbackState,
  dt: number,
  scene: THREE.Scene,
): void {
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.life -= dt;
    if (ft.life <= 0) {
      scene.remove(ft.mesh);
      ft.mesh.geometry.dispose();
      (ft.mesh.material as THREE.Material).dispose();
      state.floatingTexts.splice(i, 1);
      continue;
    }
    ft.mesh.position.addScaledVector(ft.velocity, dt);
    ft.velocity.y -= dt * 0.8; // gravity
    const alpha = Math.min(1, ft.life / (ft.maxLife * 0.3));
    (ft.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
    const scale = 1 + (1 - ft.life / ft.maxLife) * 0.15;
    ft.mesh.scale.set(scale, scale, scale);
  }
}

// ── Muzzle Flash ───────────────────────────────────────────

/**
 * Spawn a brief point-light flash at the firing position.
 * Call `tickMuzzleFlashes` each frame to fade them out.
 */
export function spawnMuzzleFlash(
  state: CombatFeedbackState,
  scene: THREE.Scene,
  position: THREE.Vector3,
  color = 0xffaa33,
): void {
  const light = new THREE.PointLight(color, 3, 4, 2);
  light.position.copy(position);
  scene.add(light);
  state.muzzleFlashes.push({ light, life: 0.08 });
}

/** Update all muzzle flashes. Call once per frame. */
export function tickMuzzleFlashes(
  state: CombatFeedbackState,
  dt: number,
  scene: THREE.Scene,
): void {
  for (let i = state.muzzleFlashes.length - 1; i >= 0; i--) {
    const mf = state.muzzleFlashes[i];
    mf.life -= dt;
    if (mf.life <= 0) {
      scene.remove(mf.light);
      mf.light.dispose();
      state.muzzleFlashes.splice(i, 1);
      continue;
    }
    mf.light.intensity = (mf.life / 0.08) * 3;
  }
}

// ── Death Explosion ────────────────────────────────────────

const EXPLOSION_COLORS = [
  0xff6b35, 0xffa62b, 0xffd700, 0xff4444, 0xff8855, 0xffcc00,
];

/**
 * Spawn a burst of small debris particles at `worldPos`.
 * Particles spread outward and fade over ~0.6 seconds.
 */
export function spawnDeathExplosion(
  state: CombatFeedbackState,
  scene: THREE.Scene,
  worldPos: THREE.Vector3,
  count = 12,
): void {
  const group = new THREE.Group();
  group.position.copy(worldPos);
  const particles: THREE.Mesh[] = [];

  const geo = new THREE.OctahedronGeometry(0.08, 0);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)],
      transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    mesh.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      1 + Math.random() * 2,
      Math.sin(angle) * speed,
    );
    mesh.position.set(0, 0, 0);
    group.add(mesh);
    particles.push(mesh);
  }

  // Central flash
  const flashGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
  });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.userData.velocity = new THREE.Vector3(0, 0, 0);
  flashMesh.userData.isFlash = true;
  group.add(flashMesh);
  particles.push(flashMesh);

  scene.add(group);
  state.deathExplosions.push({ group, particles, life: 0.7 });
}

/** Update all death explosions. Call once per frame. */
export function tickDeathExplosions(
  state: CombatFeedbackState,
  dt: number,
  scene: THREE.Scene,
): void {
  for (let i = state.deathExplosions.length - 1; i >= 0; i--) {
    const ex = state.deathExplosions[i];
    ex.life -= dt;
    if (ex.life <= 0) {
      scene.remove(ex.group);
      for (const p of ex.particles) {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      }
      state.deathExplosions.splice(i, 1);
      continue;
    }

    const alpha = Math.max(0, ex.life / 0.7);
    for (const p of ex.particles) {
      const vel = p.userData.velocity as THREE.Vector3;
      if (p.userData.isFlash) {
        // Flash expands then vanishes
        const flashAlpha = Math.max(0, ex.life / 0.7);
        const scale = 1 + (1 - flashAlpha) * 3;
        p.scale.set(scale, scale, scale);
        (p.material as THREE.MeshBasicMaterial).opacity = flashAlpha * 0.8;
      } else {
        p.position.addScaledVector(vel, dt);
        vel.y -= dt * 6; // gravity
        p.rotation.x += dt * 8;
        p.rotation.z += dt * 5;
        (p.material as THREE.MeshBasicMaterial).opacity = alpha;
        const shrink = 0.5 + alpha * 0.5;
        p.scale.set(shrink, shrink, shrink);
      }
    }
  }
}

// ── Cleanup ────────────────────────────────────────────────

/** Remove all combat feedback objects from the scene and reset state. */
export function disposeCombatFeedback(
  state: CombatFeedbackState,
  scene: THREE.Scene,
): void {
  for (const ft of state.floatingTexts) {
    scene.remove(ft.mesh);
    ft.mesh.geometry.dispose();
    (ft.mesh.material as THREE.Material).dispose();
  }
  state.floatingTexts.length = 0;

  for (const mf of state.muzzleFlashes) {
    scene.remove(mf.light);
    mf.light.dispose();
  }
  state.muzzleFlashes.length = 0;

  for (const ex of state.deathExplosions) {
    scene.remove(ex.group);
    for (const p of ex.particles) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
  }
  state.deathExplosions.length = 0;
}
