import { describe, it, expect } from 'vitest';
import {
  createOverdriveState,
  addOverdriveCharge,
  activateOverdrive,
  tickOverdrive,
  isOverdriveActive,
  canActivateOverdrive,
  getOverdriveTimeScale,
  getOverdriveDamageMult,
  getOverdriveFireRateMult,
  getOverdriveChargeFraction,
  getOverdriveProgressFraction,
  OVERDRIVE_DURATION,
  OVERDRIVE_COOLDOWN,
  OVERDRIVE_CHARGE_PER_KILL,
  OverdrivePhase,
} from '../src/game/overdrive';

describe('overdrive system', () => {
  it('starts in charging phase with 0 charge', () => {
    const s = createOverdriveState();
    expect(s.phase).toBe(OverdrivePhase.Charging);
    expect(s.charge).toBe(0);
    expect(s.activeTimer).toBe(0);
    expect(s.cooldownTimer).toBe(0);
  });

  it('cannot activate without full charge', () => {
    const s = createOverdriveState();
    const result = activateOverdrive(s);
    expect(result.phase).toBe(OverdrivePhase.Charging);
  });

  it('addOverdriveCharge accumulates charge', () => {
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 0.3);
    expect(s.charge).toBe(0.3);
    s = addOverdriveCharge(s, 0.5);
    expect(s.charge).toBe(0.8);
  });

  it('charge caps at 1.0', () => {
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 0.6);
    s = addOverdriveCharge(s, 0.6);
    expect(s.charge).toBe(1.0);
  });

  it('can activate at full charge', () => {
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    expect(canActivateOverdrive(s)).toBe(true);
    s = activateOverdrive(s);
    expect(s.phase).toBe(OverdrivePhase.Active);
    expect(s.activeTimer).toBe(OVERDRIVE_DURATION);
    expect(s.charge).toBe(0);
  });

  it('activation returns unchanged state if not ready', () => {
    const s = createOverdriveState();
    const result = activateOverdrive(s);
    expect(result).toEqual(s);
  });

  it('tick depletes active timer', () => {
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    s = activateOverdrive(s);
    s = tickOverdrive(s, 1.0);
    expect(s.phase).toBe(OverdrivePhase.Active);
    expect(s.activeTimer).toBe(OVERDRIVE_DURATION - 1.0);
  });

  it('tick transitions active → cooldown when timer expires', () => {
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    s = activateOverdrive(s);
    s = tickOverdrive(s, OVERDRIVE_DURATION + 0.1);
    expect(s.phase).toBe(OverdrivePhase.Cooldown);
    expect(s.cooldownTimer).toBeCloseTo(OVERDRIVE_COOLDOWN, 1);
  });

  it('tick transitions cooldown → charging when done', () => {
    let s = createOverdriveState();
    s = { ...s, phase: OverdrivePhase.Cooldown, cooldownTimer: 0.5 };
    s = tickOverdrive(s, 1.0);
    expect(s.phase).toBe(OverdrivePhase.Charging);
  });

  it('isOverdriveActive only true during active phase', () => {
    expect(isOverdriveActive(createOverdriveState())).toBe(false);
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    s = activateOverdrive(s);
    expect(isOverdriveActive(s)).toBe(true);
  });

  it('time scale is 0.25 during overdrive, 1 otherwise', () => {
    expect(getOverdriveTimeScale(createOverdriveState())).toBe(1);
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    s = activateOverdrive(s);
    expect(getOverdriveTimeScale(s)).toBe(0.25);
  });

  it('damage multiplier is 3x during overdrive, 1 otherwise', () => {
    expect(getOverdriveDamageMult(createOverdriveState())).toBe(1);
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    s = activateOverdrive(s);
    expect(getOverdriveDamageMult(s)).toBe(3);
  });

  it('fire rate multiplier is 2x during overdrive, 1 otherwise', () => {
    expect(getOverdriveFireRateMult(createOverdriveState())).toBe(1);
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    s = activateOverdrive(s);
    expect(getOverdriveFireRateMult(s)).toBe(2);
  });

  it('charge fraction is 0 during cooldown', () => {
    let s = createOverdriveState();
    s = { ...s, phase: OverdrivePhase.Cooldown, cooldownTimer: 5 };
    expect(getOverdriveChargeFraction(s)).toBe(0);
  });

  it('progress fraction works for all phases', () => {
    // Charging
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 0.5);
    expect(getOverdriveProgressFraction(s)).toBe(0.5);
    // Active
    s = { ...createOverdriveState(), phase: OverdrivePhase.Active, activeTimer: 2, charge: 0, cooldownTimer: 0 };
    expect(getOverdriveProgressFraction(s)).toBe(2 / OVERDRIVE_DURATION);
    // Cooldown
    s = { ...createOverdriveState(), phase: OverdrivePhase.Cooldown, cooldownTimer: 6, charge: 0, activeTimer: 0 };
    expect(getOverdriveProgressFraction(s)).toBe(1 - 6 / OVERDRIVE_COOLDOWN);
  });

  it('charge does not accumulate during cooldown', () => {
    let s = { ...createOverdriveState(), phase: OverdrivePhase.Cooldown, cooldownTimer: 5 };
    s = addOverdriveCharge(s, 0.5);
    expect(s.charge).toBe(0);
  });

  it('charge does not accumulate during active', () => {
    let s = createOverdriveState();
    s = addOverdriveCharge(s, 1.0);
    s = activateOverdrive(s);
    s = addOverdriveCharge(s, 1.0);
    expect(s.charge).toBe(0);
  });

  it('cannot activate during cooldown', () => {
    const s = { ...createOverdriveState(), phase: OverdrivePhase.Cooldown, cooldownTimer: 5 };
    expect(canActivateOverdrive(s)).toBe(false);
  });

  it('full lifecycle: charge → activate → expire → cooldown → recharge', () => {
    let s = createOverdriveState();
    // Charge up with kills at combo tier 2 (multiplier 1.5)
    // 0.08 * 1.5 = 0.12 per kill → need ~9 kills to fill
    for (let i = 0; i < 9; i++) {
      s = addOverdriveCharge(s, OVERDRIVE_CHARGE_PER_KILL * 1.5);
    }
    expect(s.charge).toBeCloseTo(1.08, 0); // capped at 1.0, within tolerance
    expect(s.charge).toBe(1.0); // exactly capped

    // Activate
    s = activateOverdrive(s);
    expect(s.phase).toBe(OverdrivePhase.Active);

    // Tick through active phase
    s = tickOverdrive(s, OVERDRIVE_DURATION);
    expect(s.phase).toBe(OverdrivePhase.Cooldown);

    // Tick through cooldown
    s = tickOverdrive(s, OVERDRIVE_COOLDOWN);
    expect(s.phase).toBe(OverdrivePhase.Charging);

    // Can charge again
    s = addOverdriveCharge(s, 0.3);
    expect(s.charge).toBe(0.3);
  });
});
