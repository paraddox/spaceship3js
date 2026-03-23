import * as THREE from 'three';

// ── Combat VFX System ──────────────────────────────────────────
//
// Lightweight particle system for combat visual feedback.
// Uses object-pooled sprites with velocity, gravity, and fade.
// No extra dependencies — pure Three.js sprites.
//
// Supports:
// - Explosion bursts (ship death, module destruction)
// - Hit sparks (projectile impact)
// - Shield shimmer (shield absorption)
// - Thrust trails (engine exhaust)
// - Afterburner glow (enhanced thrust visual)

export interface Particle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
  endOpacity: number;
  active: boolean;
  drag: number;
}

export interface ParticleConfig {
  position: THREE.Vector3;
  count: number;
  speed: [number, number];      // min, max initial speed
  life: [number, number];       // min, max lifetime in seconds
  gravity?: number;
  startScale: [number, number];
  endScale?: [number, number];
  startOpacity?: number;
  endOpacity?: number;
  drag?: number;
  color: string;
  spreadAngle?: number;         // 0 = all directions, PI/4 = narrow cone upward
  direction?: THREE.Vector3;     // if set, particles emit in this direction ± spread
}

const MAX_PARTICLES = 400;

export class ParticleSystem {
  readonly group = new THREE.Group();
  private readonly pool: Particle[] = [];

  private texture: THREE.Texture | null = null;

  constructor() {
    this.group.renderOrder = 10; // render above ships

    // Defer texture creation to first use (browser-only)
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const material = new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      this.group.add(sprite);
      this.pool.push({
        sprite,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
        gravity: 0,
        startScale: 1,
        endScale: 0,
        startOpacity: 1,
        endOpacity: 0,
        active: false,
        drag: 0,
      });
    }
  }

  private ensureTexture(): THREE.Texture {
    if (this.texture) return this.texture;
    if (typeof document === 'undefined') {
      // Fallback: plain white 1x1 texture for tests
      this.texture = new THREE.Texture();
    } else {
      this.texture = this.createParticleTexture();
    }
    // Apply to all sprites
    for (const p of this.pool) {
      (p.sprite.material as THREE.SpriteMaterial).map = this.texture;
      (p.sprite.material as THREE.SpriteMaterial).needsUpdate = true;
    }
    return this.texture;
  }

  /** Emit a burst of particles from a config. */
  emit(config: ParticleConfig): void {
    this.ensureTexture();

    const color = new THREE.Color(config.color);
    const speedRange = config.speed;
    const lifeRange = config.life;
    const scaleRange = config.startScale;
    const endScaleRange = config.endScale ?? [0, 0.1];
    const startOpacity = config.startOpacity ?? 1;
    const endOpacity = config.endOpacity ?? 0;
    const gravity = config.gravity ?? 0;
    const drag = config.drag ?? 0;
    const spreadAngle = config.spreadAngle ?? Math.PI; // full sphere by default
    const direction = config.direction;

    for (let i = 0; i < config.count; i++) {
      const particle = this.findInactive();
      if (!particle) return;

      const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      const life = lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]);
      const scale = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
      const endScale = endScaleRange[0] + Math.random() * (endScaleRange[1] - endScaleRange[0]);

      // Compute velocity direction
      let vx: number, vy: number, vz: number;
      if (direction) {
        // Emit in direction ± spread
        const theta = (Math.random() - 0.5) * spreadAngle;
        const phi = (Math.random() - 0.5) * spreadAngle;
        const dx = direction.x;
        const dz = direction.z;
        const len = Math.hypot(dx, dz) || 1;
        const baseAngle = Math.atan2(dx / len, dz / len);
        const finalAngle = baseAngle + theta;
        vx = Math.sin(finalAngle) * speed * Math.cos(phi);
        vz = Math.cos(finalAngle) * speed * Math.cos(phi);
        vy = Math.sin(phi) * speed;
      } else {
        // Random sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        vx = Math.sin(phi) * Math.cos(theta) * speed;
        vy = Math.sin(phi) * Math.sin(theta) * speed * 0.4; // flatten vertically
        vz = Math.cos(phi) * speed;
      }

      particle.velocity.set(vx, vy, vz);
      particle.life = life;
      particle.maxLife = life;
      particle.gravity = gravity;
      particle.startScale = scale;
      particle.endScale = endScale;
      particle.startOpacity = startOpacity;
      particle.endOpacity = endOpacity;
      particle.active = true;
      particle.drag = drag;

      particle.sprite.position.copy(config.position);
      particle.sprite.position.y = 0.3; // slightly above ground plane
      particle.sprite.scale.setScalar(scale);
      (particle.sprite.material as THREE.SpriteMaterial).color.copy(color);
      (particle.sprite.material as THREE.SpriteMaterial).opacity = startOpacity;
      particle.sprite.visible = true;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      const t = 1 - p.life / p.maxLife; // 0 → 1 progress

      // Physics
      p.velocity.y += p.gravity * dt;
      p.velocity.multiplyScalar(1 - p.drag * dt);
      p.sprite.position.addScaledVector(p.velocity, dt);

      // Visual interpolation
      const scale = p.startScale + (p.endScale - p.startScale) * t;
      p.sprite.scale.setScalar(Math.max(0.01, scale));
      (p.sprite.material as THREE.SpriteMaterial).opacity = p.startOpacity + (p.endOpacity - p.startOpacity) * t;

      // Hide when fully faded
      if ((p.sprite.material as THREE.SpriteMaterial).opacity <= 0.01) {
        p.active = false;
        p.sprite.visible = false;
      }
    }
  }

  dispose(): void {
    for (const p of this.pool) {
      (p.sprite.material as THREE.SpriteMaterial).dispose();
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.active = false;
      p.sprite.visible = false;
    }
  }

  // ── Preset emitters ──

  static explosionBurst(position: THREE.Vector3, color = '#f59e0b', count = 18): ParticleConfig {
    return {
      position,
      count,
      speed: [3, 10],
      life: [0.3, 0.8],
      gravity: -2,
      startScale: [0.3, 0.8],
      endScale: [0, 0.15],
      color,
      drag: 2,
    };
  }

  static deathExplosion(position: THREE.Vector3): ParticleConfig[] {
    return [
      ParticleSystem.explosionBurst(position.clone(), '#f59e0b', 30),
      ParticleSystem.explosionBurst(position.clone(), '#ef4444', 20),
      {
        position: position.clone(),
        count: 12,
        speed: [1, 4],
        life: [0.6, 1.4],
        gravity: -1,
        startScale: [0.6, 1.2],
        endScale: [0.2, 0.5],
        startOpacity: 0.8,
        endOpacity: 0,
        color: '#fbbf24',
        drag: 1.5,
      },
    ];
  }

  static hitSpark(position: THREE.Vector3, color = '#fde68a'): ParticleConfig {
    return {
      position,
      count: 6,
      speed: [2, 5],
      life: [0.1, 0.25],
      startScale: [0.15, 0.3],
      endScale: [0, 0.05],
      color,
      drag: 4,
    };
  }

  static shieldAbsorb(position: THREE.Vector3, color = '#38bdf8'): ParticleConfig {
    return {
      position: position.clone().setY(0.35),
      count: 10,
      speed: [1, 3],
      life: [0.15, 0.35],
      startScale: [0.2, 0.5],
      endScale: [0.3, 0.7],
      startOpacity: 0.7,
      endOpacity: 0,
      color,
      drag: 3,
    };
  }

  /** Burst of energy when player activates dash */
  static dashBurst(position: THREE.Vector3): ParticleConfig {
    return {
      position: position.clone().setY(0.2),
      count: 20,
      speed: [2, 6],
      life: [0.1, 0.25],
      startScale: [0.3, 0.6],
      endScale: [0.05, 0.15],
      startOpacity: 0.9,
      endOpacity: 0,
      color: '#38bdf8',
      drag: 4,
    };
  }

  static thrustTrail(position: THREE.Vector3, direction: THREE.Vector3, isAfterburning = false): ParticleConfig {
    return {
      position: position.clone().setY(0.15),
      count: 1,
      speed: [0.5, 1.5],
      life: [0.15, 0.3],
      startScale: [0.15, 0.25],
      endScale: [0, 0.08],
      startOpacity: isAfterburning ? 0.8 : 0.4,
      endOpacity: 0,
      color: isAfterburning ? '#f97316' : '#94a3b8',
      direction: direction.clone().negate(),
      spreadAngle: isAfterburning ? 0.5 : 0.3,
      drag: 5,
    };
  }

  static comboBurst(position: THREE.Vector3, color = '#fbbf24'): ParticleConfig {
    return {
      position: position.clone().setY(0.3),
      count: 24,
      speed: [3, 8],
      life: [0.3, 0.7],
      gravity: -1,
      startScale: [0.2, 0.45],
      endScale: [0, 0.05],
      startOpacity: 0.9,
      endOpacity: 0,
      color,
      drag: 3,
    };
  }

  // ── Boss Encounter VFX ──

  static bossPhaseTransition(position: THREE.Vector3): ParticleConfig {
    return {
      position: position.clone().setY(0.5),
      count: 40,
      speed: [4, 10],
      life: [0.4, 1.0],
      gravity: -2,
      startScale: [0.3, 0.6],
      endScale: [0, 0.05],
      startOpacity: 1.0,
      endOpacity: 0,
      color: '#ef4444',
      drag: 2,
    };
  }

  static bossTelegraphPulse(position: THREE.Vector3, color = '#f97316'): ParticleConfig {
    return {
      position: position.clone().setY(0.1),
      count: 8,
      speed: [1, 3],
      life: [0.2, 0.5],
      startScale: [0.15, 0.3],
      endScale: [0, 0.05],
      startOpacity: 0.7,
      endOpacity: 0,
      color,
      drag: 4,
    };
  }

  static bossShockwaveRing(position: THREE.Vector3, color = '#fbbf24'): ParticleConfig {
    return {
      position: position.clone().setY(0.2),
      count: 20,
      speed: [6, 14],
      life: [0.3, 0.6],
      startScale: [0.2, 0.4],
      endScale: [0, 0.05],
      startOpacity: 0.8,
      endOpacity: 0,
      color,
      drag: 1,
    };
  }

  static bossDeathExplosion(position: THREE.Vector3): ParticleConfig {
    return {
      position: position.clone().setY(0.5),
      count: 60,
      speed: [5, 15],
      life: [0.5, 1.5],
      gravity: -3,
      startScale: [0.3, 0.7],
      endScale: [0, 0.05],
      startOpacity: 1.0,
      endOpacity: 0,
      color: '#fbbf24',
      drag: 1.5,
    };
  }

  // ── Internal ──

  private findInactive(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return null;
  }

  private createParticleTexture(): THREE.Texture {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
}

// ── Screen Shake ────────────────────────────────────────────────

export interface ScreenShakeState {
  intensity: number;
  duration: number;
  remaining: number;
  frequency: number;
}

export function createScreenShake(intensity = 0.3, duration = 0.3, frequency = 30): ScreenShakeState {
  return { intensity, duration, remaining: duration, frequency };
}

export function updateScreenShake(
  shake: ScreenShakeState,
  camera: THREE.OrthographicCamera,
  basePosition: THREE.Vector3,
  dt: number,
): void {
  if (shake.remaining <= 0) return;
  shake.remaining -= dt;
  if (shake.remaining <= 0) {
    camera.position.copy(basePosition);
    return;
  }

  const progress = shake.remaining / shake.duration;
  const currentIntensity = shake.intensity * progress;
  const decay = Math.sin(shake.remaining * shake.frequency) * currentIntensity;
  camera.position.x = basePosition.x + (Math.random() - 0.5) * decay;
  camera.position.z = basePosition.z + (Math.random() - 0.5) * decay;
}
