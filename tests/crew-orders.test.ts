import { describe, expect, it } from 'vitest';
import {
  activateEngineerReroute,
  activateGunnerFocus,
  activatePilotSurge,
  activateTacticianLink,
  canActivateCrewOrder,
  clearCrewOrderTarget,
  createCrewOrdersState,
  getCrewOrderCooldown,
  getCrewOrderTargetId,
  getEngineerCoolingMultiplier,
  getEngineerHeatVentFraction,
  getGunnerFocusDamageMultiplier,
  getPilotThrustMultiplier,
  getTacticianComboDecayMultiplier,
  isOrderActive,
  tickCrewOrders,
} from '../src/game/crew-orders';
import type { CrewAllocation } from '../src/core/types';

const CREW: CrewAllocation = { pilot: 3, gunner: 2, engineer: 4, tactician: 1 };

describe('crew orders', () => {
  it('requires crew assigned to activate an order', () => {
    const state = createCrewOrdersState();
    expect(canActivateCrewOrder(state, 'pilot_surge', { pilot: 0, gunner: 1, engineer: 1, tactician: 1 })).toBe(false);
    expect(canActivateCrewOrder(state, 'pilot_surge', CREW)).toBe(true);
  });

  it('activates pilot surge with scaled duration and thrust bonus', () => {
    const active = activatePilotSurge(createCrewOrdersState(), CREW);
    expect(isOrderActive(active, 'pilot_surge')).toBe(true);
    expect(active.pilotCooldownRemaining).toBeCloseTo(getCrewOrderCooldown('pilot_surge', CREW), 4);
    expect(getPilotThrustMultiplier(active, CREW)).toBeGreaterThan(1.2);
  });

  it('marks a gunner focus target and only buffs that target', () => {
    const active = activateGunnerFocus(createCrewOrdersState(), CREW, 'elite-1', 'Elite One');
    expect(getCrewOrderTargetId(active)).toBe('elite-1');
    expect(getGunnerFocusDamageMultiplier(active, CREW, 'elite-1')).toBeGreaterThan(1);
    expect(getGunnerFocusDamageMultiplier(active, CREW, 'other')).toBe(1);
  });

  it('keeps engineer reroute active as a cooling window', () => {
    const active = activateEngineerReroute(createCrewOrdersState(), CREW);
    expect(getEngineerCoolingMultiplier(active, CREW)).toBeGreaterThan(1.2);
    expect(getEngineerHeatVentFraction(CREW)).toBeGreaterThan(0.4);
  });

  it('lets tactician link preserve a target and slow combo decay', () => {
    const active = activateTacticianLink(createCrewOrdersState(), CREW, 'boss-1', 'Boss');
    expect(getCrewOrderTargetId(active)).toBe('boss-1');
    expect(getTacticianComboDecayMultiplier(active, CREW)).toBeLessThan(1);
  });

  it('ticks timers down and clears expired targets', () => {
    const state = activateGunnerFocus(createCrewOrdersState(), CREW, 'elite-1', 'Elite One');
    const expired = tickCrewOrders(state, 10);
    expect(isOrderActive(expired, 'gunner_focus')).toBe(false);
    expect(getCrewOrderTargetId(expired)).toBe(null);
  });

  it('clears matching crew-order targets when ships die', () => {
    const state = activateTacticianLink(
      activateGunnerFocus(createCrewOrdersState(), CREW, 'elite-1', 'Elite One'),
      CREW,
      'boss-1',
      'Boss',
    );
    const clearedGunner = clearCrewOrderTarget(state, 'elite-1');
    expect(getCrewOrderTargetId(clearedGunner)).toBe('boss-1');
    const clearedAll = clearCrewOrderTarget(clearedGunner, 'boss-1');
    expect(getCrewOrderTargetId(clearedAll)).toBe(null);
  });
});
