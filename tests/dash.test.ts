import { describe, it, expect } from 'vitest';
import {
  createDashState,
  canDash,
  startDash,
  updateDash,
  isInvulnerable,
  isDashing,
  getDashProgress,
} from '../src/game/dash';

describe('dash', () => {
  describe('createDashState', () => {
    it('starts ready to dash', () => {
      const dash = createDashState();
      expect(dash.active).toBe(false);
      expect(dash.cooldownRemaining).toBe(0);
      expect(dash.invulnRemaining).toBe(0);
      expect(canDash(dash)).toBe(true);
    });
  });

  describe('startDash', () => {
    it('activates dash in the input direction', () => {
      const dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      expect(dash.active).toBe(true);
      expect(dash.dashDirX).toBeCloseTo(0);
      expect(dash.dashDirZ).toBeCloseTo(1);
    });

    it('activates dash in face direction when no input', () => {
      const dash = startDash(createDashState(), 0, 0, 0, 0, Math.PI / 2, 0);
      expect(dash.active).toBe(true);
      expect(dash.dashDirX).toBeCloseTo(1);
      expect(dash.dashDirZ).toBeCloseTo(0);
    });

    it('uses combined forward+strafe direction', () => {
      const dash = startDash(createDashState(), 1, 0, 0, 1, 0, 0);
      const len = Math.hypot(dash.dashDirX, dash.dashDirZ);
      expect(len).toBeCloseTo(1);
      // Forward (1,0) + Strafe (0,1) = (1,1) → normalized (0.707, 0.707)
      expect(dash.dashDirX).toBeCloseTo(Math.SQRT1_2);
      expect(dash.dashDirZ).toBeCloseTo(Math.SQRT1_2);
    });

    it('sets invulnerability', () => {
      const dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      expect(dash.invulnRemaining).toBeCloseTo(0.2);
      expect(isInvulnerable(dash)).toBe(true);
    });

    it('sets cooldown', () => {
      const dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      expect(dash.cooldownRemaining).toBeCloseTo(2.5);
      expect(canDash(dash)).toBe(false);
    });

    it('reduces cooldown with reduction factor', () => {
      const dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0.5);
      expect(dash.cooldownRemaining).toBeCloseTo(1.25);
    });

    it('cannot dash while already dashing', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      expect(canDash(dash)).toBe(false);
    });

    it('cannot dash while on cooldown', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      // Update through the dash
      for (let i = 0; i < 20; i++) dash = updateDash(dash, 0.1);
      expect(dash.active).toBe(false);
      expect(dash.cooldownRemaining).toBeGreaterThan(0);
      expect(canDash(dash)).toBe(false);
    });
  });

  describe('updateDash', () => {
    it('ticks down dash timer', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      dash = updateDash(dash, 0.1);
      expect(dash.dashTimer).toBeCloseTo(0.05);
    });

    it('deactivates after dash duration', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      dash = updateDash(dash, 0.15);
      expect(dash.active).toBe(false);
    });

    it('invulnerability outlasts dash duration', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      // Dash ends at 0.15s, invuln at 0.2s
      dash = updateDash(dash, 0.16);
      expect(dash.active).toBe(false);
      expect(isInvulnerable(dash)).toBe(true);
      dash = updateDash(dash, 0.04);
      expect(isInvulnerable(dash)).toBe(false);
    });

    it('ticks cooldown when not dashing', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      // Run just past dash + invuln
      dash = updateDash(dash, 0.25);
      expect(dash.active).toBe(false);
      const cooldownBefore = dash.cooldownRemaining;
      expect(cooldownBefore).toBeGreaterThan(0);
      dash = updateDash(dash, 0.5);
      expect(dash.cooldownRemaining).toBeCloseTo(cooldownBefore - 0.5);
    });

    it('cooldown reaches zero eventually', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      for (let i = 0; i < 100; i++) dash = updateDash(dash, 0.1);
      expect(canDash(dash)).toBe(true);
      expect(dash.cooldownRemaining).toBe(0);
    });

    it('ticks down nebula boost', () => {
      let dash = { ...createDashState(), nebulaBoostRemaining: 2 };
      dash = updateDash(dash, 0.5);
      expect(dash.nebulaBoostRemaining).toBeCloseTo(1.5);
      dash = updateDash(dash, 2);
      expect(dash.nebulaBoostRemaining).toBe(0);
    });
  });

  describe('getDashProgress', () => {
    it('returns 1 when ready', () => {
      const dash = createDashState();
      expect(getDashProgress(dash)).toBe(1);
    });

    it('returns < 1 during cooldown', () => {
      let dash = startDash(createDashState(), 0, 1, 0, 0, 0, 0);
      for (let i = 0; i < 5; i++) dash = updateDash(dash, 0.3);
      const progress = getDashProgress(dash);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);
    });
  });
});
