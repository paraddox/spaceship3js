import { describe, it, expect } from 'vitest';
import {
  createHazardState,
  createHazardStates,
  updateHazard,
  applyShipHazardCollision,
  damageAsteroid,
  checkProjectileAsteroidCollision,
  checkProjectileNebulaBoost,
  computeHazardSteering,
  generateRandomHazards,
} from '../src/game/hazards';

describe('hazard system', () => {
  describe('createHazardState', () => {
    it('creates asteroid with HP', () => {
      const h = createHazardState({ kind: 'asteroid', x: 3, z: -5, radius: 1.2, hp: 100 });
      expect(h.kind).toBe('asteroid');
      expect(h.x).toBe(3);
      expect(h.z).toBe(-5);
      expect(h.radius).toBe(1.2);
      expect(h.hp).toBe(100);
      expect(h.maxHp).toBe(100);
      expect(h.active).toBe(true);
    });

    it('creates shield conduit with charge', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 5, radius: 1.5 });
      expect(h.kind).toBe('shield_conduit');
      expect(h.charge).toBe(1);
      expect(h.shieldRestore).toBe(18);
      expect(h.active).toBe(true);
    });

    it('creates damage nebula with DPS', () => {
      const h = createHazardState({ kind: 'damage_nebula', x: -8, z: -5, radius: 2.5, damagePerSecond: 14 });
      expect(h.kind).toBe('damage_nebula');
      expect(h.damagePerSecond).toBe(14);
      expect(h.damageType).toBe('energy');
      expect(h.active).toBe(true);
    });

    it('defaults asteroid HP to 80', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1 });
      expect(h.hp).toBe(80);
      expect(h.maxHp).toBe(80);
    });

    it('defaults nebula DPS to 14', () => {
      const h = createHazardState({ kind: 'damage_nebula', x: 0, z: 0, radius: 2 });
      expect(h.damagePerSecond).toBe(14);
    });
  });

  describe('createHazardStates', () => {
    it('creates multiple hazard states from spawns', () => {
      const spawns = [
        { kind: 'asteroid' as const, x: 0, z: 0, radius: 1 },
        { kind: 'shield_conduit' as const, x: 5, z: 5, radius: 1.5 },
        { kind: 'damage_nebula' as const, x: -3, z: -3, radius: 2 },
      ];
      const states = createHazardStates(spawns);
      expect(states).toHaveLength(3);
      expect(states[0].kind).toBe('asteroid');
      expect(states[1].kind).toBe('shield_conduit');
      expect(states[2].kind).toBe('damage_nebula');
    });

    it('returns empty array for empty input', () => {
      expect(createHazardStates([])).toHaveLength(0);
    });
  });

  describe('updateHazard', () => {
    it('recharges shield conduit over time', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 1.5 });
      h.charge = 0.5;
      const updated = updateHazard(h, 1);
      expect(updated.charge).toBeCloseTo(0.6, 2);
    });

    it('clamps conduit charge to 1', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 1.5 });
      h.charge = 0.95;
      const updated = updateHazard(h, 10);
      expect(updated.charge).toBe(1);
    });

    it('advances nebula pulse phase', () => {
      const h = createHazardState({ kind: 'damage_nebula', x: 0, z: 0, radius: 2 });
      const phase0 = h.pulsePhase;
      const updated = updateHazard(h, 1);
      expect(updated.pulsePhase).toBeCloseTo(phase0 + 1.8, 2);
    });

    it('does nothing for inactive hazards', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1 });
      h.active = false;
      const updated = updateHazard(h, 1);
      expect(updated.hp).toBe(h.hp);
    });
  });

  describe('applyShipHazardCollision', () => {
    it('pushes ship out of asteroid', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1.5 });
      // Ship at (0.5, 0) with radius 0.5 => overlap = 1.5 + 0.5 - 0.5 = 1.5, push along +X
      const result = applyShipHazardCollision(h, 'ship-1', 0.5, 0, 0.5, 0.016, 0);
      expect(result.pushX).not.toBe(0);
      expect(result.shieldRestored).toBe(0);
      expect(result.damageTaken).toBe(0);
    });

    it('no collision when ship is far from asteroid', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1 });
      const result = applyShipHazardCollision(h, 'ship-1', 5, 5, 0.5, 0.016, 0);
      expect(result.pushX).toBe(0);
      expect(result.pushZ).toBe(0);
    });

    it('no collision with inactive hazard', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 2 });
      h.active = false;
      const result = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 0);
      expect(result.pushX).toBe(0);
    });

    it('shield conduit restores shields', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 2 });
      const result = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 10);
      expect(result.shieldRestored).toBeGreaterThan(0);
      expect(result.damageTaken).toBe(0);
    });

    it('shield conduit restores continuously while inside', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 2 });
      const r1 = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 10);
      expect(r1.shieldRestored).toBeGreaterThan(0);

      // Continuous restoration — no per-ship cooldown between ticks
      const r2 = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 10.016);
      expect(r2.shieldRestored).toBeGreaterThan(0);
    });

    it('depleted conduit does not restore', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 2 });
      h.charge = 0.01;
      const result = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 10);
      expect(result.shieldRestored).toBe(0);
    });

    it('damage nebula deals energy damage', () => {
      const h = createHazardState({ kind: 'damage_nebula', x: 0, z: 0, radius: 3, damagePerSecond: 20 });
      const result = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 0);
      expect(result.damageTaken).toBeGreaterThan(0);
      expect(result.shieldRestored).toBe(0);
      expect(result.shieldDrainMultiplier).toBe(2.0);
    });

    it('damage nebula pulses damage', () => {
      const h = createHazardState({ kind: 'damage_nebula', x: 0, z: 0, radius: 3, damagePerSecond: 20 });
      h.pulsePhase = Math.PI / 2; // sin = 1 => max pulse
      const r1 = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 0);

      h.pulsePhase = -Math.PI / 2; // sin = -1 => min pulse
      const r2 = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 0);

      expect(r1.damageTaken).toBeGreaterThan(r2.damageTaken);
    });

    it('different ships can use conduit independently', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 2 });
      const r1 = applyShipHazardCollision(h, 'ship-1', 0, 0, 0.5, 0.016, 10);
      expect(r1.shieldRestored).toBeGreaterThan(0);

      const r2 = applyShipHazardCollision(h, 'ship-2', 0, 0, 0.5, 0.016, 10);
      expect(r2.shieldRestored).toBeGreaterThan(0);
    });
  });

  describe('damageAsteroid', () => {
    it('reduces HP', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1, hp: 100 });
      const updated = damageAsteroid(h, 30);
      expect(updated.hp).toBe(70);
      expect(updated.active).toBe(true);
    });

    it('deactivates asteroid when HP reaches 0', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1, hp: 20 });
      const updated = damageAsteroid(h, 25);
      expect(updated.hp).toBe(0);
      expect(updated.active).toBe(false);
    });

    it('does nothing for non-asteroid hazards', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 1.5 });
      const updated = damageAsteroid(h, 50);
      expect(updated.charge).toBe(h.charge);
    });

    it('does nothing for inactive asteroids', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1, hp: 100 });
      h.active = false;
      const updated = damageAsteroid(h, 50);
      expect(updated.hp).toBe(100);
    });
  });

  describe('checkProjectileAsteroidCollision', () => {
    it('detects collision when projectile is inside asteroid', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1.5 });
      expect(checkProjectileAsteroidCollision(0, 0, h)).toBe(true);
    });

    it('no collision when projectile is outside', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1 });
      expect(checkProjectileAsteroidCollision(3, 3, h)).toBe(false);
    });

    it('no collision for non-asteroid or inactive', () => {
      const conduit = createHazardState({ kind: 'shield_conduit', x: 0, z: 0, radius: 2 });
      expect(checkProjectileAsteroidCollision(0, 0, conduit)).toBe(false);

      const dead = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 2 });
      dead.active = false;
      expect(checkProjectileAsteroidCollision(0, 0, dead)).toBe(false);
    });
  });

  describe('checkProjectileNebulaBoost', () => {
    it('detects projectile inside nebula', () => {
      const h = createHazardState({ kind: 'damage_nebula', x: 0, z: 0, radius: 3 });
      expect(checkProjectileNebulaBoost(0, 0, h)).toBe(true);
    });

    it('no boost for projectile outside nebula', () => {
      const h = createHazardState({ kind: 'damage_nebula', x: 0, z: 0, radius: 1 });
      expect(checkProjectileNebulaBoost(5, 5, h)).toBe(false);
    });

    it('no boost for non-nebula', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 2 });
      expect(checkProjectileNebulaBoost(0, 0, h)).toBe(false);
    });
  });

  describe('computeHazardSteering', () => {
    it('repels from nearby asteroid', () => {
      const hazards = [createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1.5 })];
      const steer = computeHazardSteering(1, 0, hazards, false, false);
      // Should push away from asteroid (positive x direction)
      expect(steer.x).toBeGreaterThan(0);
    });

    it('no steering when far from hazards', () => {
      const hazards = [createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 1 })];
      const steer = computeHazardSteering(10, 10, hazards, false, false);
      expect(steer.x).toBe(0);
      expect(steer.z).toBe(0);
    });

    it('repels from damage nebula when avoidNebula is true', () => {
      const hazards = [createHazardState({ kind: 'damage_nebula', x: 0, z: 0, radius: 3 })];
      const steer = computeHazardSteering(1, 0, hazards, false, true);
      expect(steer.x).toBeGreaterThan(0);
    });

    it('seeks charged conduit when seekConduit is true', () => {
      const h = createHazardState({ kind: 'shield_conduit', x: 5, z: 0, radius: 1.5 });
      const steer = computeHazardSteering(0, 0, [h], true, false);
      // Should pull toward conduit (positive x direction)
      expect(steer.x).toBeGreaterThan(0);
    });

    it('ignores inactive hazards', () => {
      const h = createHazardState({ kind: 'asteroid', x: 0, z: 0, radius: 2 });
      h.active = false;
      const steer = computeHazardSteering(0, 0, [h], false, false);
      expect(steer.x).toBe(0);
      expect(steer.z).toBe(0);
    });
  });

  describe('generateRandomHazards', () => {
    it('generates hazards for wave 1', () => {
      const hazards = generateRandomHazards(1, 16);
      expect(hazards.length).toBeGreaterThan(0);
    });

    it('generates more hazards at higher waves', () => {
      const h1 = generateRandomHazards(1, 16);
      const h10 = generateRandomHazards(10, 16);
      expect(h10.length).toBeGreaterThanOrEqual(h1.length);
    });

    it('generates hazards within arena radius', () => {
      const hazards = generateRandomHazards(20, 16);
      for (const h of hazards) {
        const dist = Math.hypot(h.x, h.z);
        expect(dist).toBeLessThan(16 + 2); // small margin for radius
      }
    });

    it('all generated hazards have valid kinds', () => {
      const hazards = generateRandomHazards(50, 16);
      const validKinds = ['asteroid', 'shield_conduit', 'damage_nebula'];
      for (const h of hazards) {
        expect(validKinds).toContain(h.kind);
      }
    });

    it('nebula DPS scales with wave number', () => {
      // Check that higher waves can produce nebulas with more DPS
      let maxDps = 0;
      for (let w = 1; w <= 20; w++) {
        const hazards = generateRandomHazards(w, 16);
        for (const h of hazards) {
          if (h.kind === 'damage_nebula' && h.damagePerSecond) {
            maxDps = Math.max(maxDps, h.damagePerSecond);
          }
        }
      }
      expect(maxDps).toBeGreaterThan(14); // wave 1 default
    });

    it('is deterministic for same wave number', () => {
      const h1 = generateRandomHazards(7, 16);
      const h2 = generateRandomHazards(7, 16);
      expect(h1).toEqual(h2);
    });
  });
});
