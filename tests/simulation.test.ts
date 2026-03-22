import { describe, expect, it } from 'vitest';
import {
  computePowerFactor,
  computeCoolingPerSecond,
  getEffectiveThrust,
  getEffectiveWeaponCadence,
  isOverheated,
  advanceEncounterState,
  resolveDamage,
  rechargeShield,
  damageModules,
  type EncounterState,
  type ModuleRuntimeState,
} from '../src/game/simulation';

describe('ship simulation helpers', () => {
  it('keeps full output when ship has enough power', () => {
    expect(computePowerFactor(50, 20)).toBe(1);
  });

  it('reduces output when demand is higher than output', () => {
    expect(computePowerFactor(20, 40)).toBeCloseTo(0.5, 4);
  });

  it('never drops below the emergency floor when there is some demand', () => {
    expect(computePowerFactor(0, 80)).toBeCloseTo(0.35, 4);
  });

  it('boosts cooling when ship has power surplus', () => {
    expect(computeCoolingPerSecond(0.4, 1.5)).toBeCloseTo(0.6, 4);
  });

  it('thrust is reduced by both power deficit and overheating', () => {
    expect(getEffectiveThrust(100, 0.5, 60, 50)).toBeCloseTo(35, 4);
  });

  it('weapon cadence drops under power deficit and heavy heat', () => {
    expect(getEffectiveWeaponCadence(2, 0.5, 55, 50)).toBeCloseTo(0.7, 4);
  });

  it('marks ships as overheated only after capacity is exceeded', () => {
    expect(isOverheated(49.9, 50)).toBe(false);
    expect(isOverheated(50.1, 50)).toBe(true);
  });
});

describe('encounter progression', () => {
  it('requests the next wave when the current wave is cleared', () => {
    const state: EncounterState = {
      currentWave: 1,
      totalWaves: 3,
      remainingEnemies: 0,
      playerAlive: true,
    };

    expect(advanceEncounterState(state)).toEqual({
      nextWave: 2,
      outcome: 'continue',
      shouldSpawnWave: true,
    });
  });

  it('declares victory after the last wave is cleared', () => {
    const state: EncounterState = {
      currentWave: 3,
      totalWaves: 3,
      remainingEnemies: 0,
      playerAlive: true,
    };

    expect(advanceEncounterState(state)).toEqual({
      nextWave: 3,
      outcome: 'victory',
      shouldSpawnWave: false,
    });
  });

  it('declares defeat when the player ship is destroyed', () => {
    const state: EncounterState = {
      currentWave: 1,
      totalWaves: 3,
      remainingEnemies: 2,
      playerAlive: false,
    };

    expect(advanceEncounterState(state)).toEqual({
      nextWave: 1,
      outcome: 'defeat',
      shouldSpawnWave: false,
    });
  });
});

describe('damage resolution', () => {
  it('energy damage is fully absorbed by shields', () => {
    const result = resolveDamage(20, 'energy', 0, 80, 0, 0, 0);
    expect(result.shieldAbsorbed).toBe(20);
    expect(result.hullDamage).toBe(0);
  });

  it('energy damage that exceeds shield overflows to hull', () => {
    const result = resolveDamage(100, 'energy', 0, 40, 0, 0, 0);
    expect(result.shieldAbsorbed).toBe(40);
    expect(result.hullDamage).toBe(60);
  });

  it('kinetic damage bypasses shields by kineticBypass fraction', () => {
    const result = resolveDamage(20, 'kinetic', 0, 80, 0, 0.7, 0);
    // 30% hits shield (20 * 0.3 = 6), 70% bypasses (14 raw to hull)
    expect(result.shieldAbsorbed).toBeCloseTo(6, 10);
    expect(result.hullDamage).toBeCloseTo(14, 10);
  });

  it('explosive damage is 50% absorbed by shields', () => {
    const result = resolveDamage(40, 'explosive', 0, 80, 0, 0, 0);
    expect(result.shieldAbsorbed).toBe(20);
    expect(result.hullDamage).toBe(20);
  });

  it('armor reduces hull damage', () => {
    // No shield, armor 12, effective reduction = 12/(12+50) ≈ 0.1935
    const result = resolveDamage(100, 'kinetic', 0, 0, 12, 0, 0);
    expect(result.shieldAbsorbed).toBe(0);
    expect(result.hullDamage).toBeCloseTo(80.65, 0);
  });

  it('armor penetration reduces effective armor', () => {
    const noPen = resolveDamage(100, 'kinetic', 0, 0, 12, 0, 0);
    const withPen = resolveDamage(100, 'kinetic', 0.4, 0, 12, 0, 0);
    expect(withPen.hullDamage).toBeGreaterThan(noPen.hullDamage);
  });

  it('energy vulnerability increases hull damage through armor', () => {
    const normal = resolveDamage(100, 'kinetic', 0, 0, 12, 0, 0);
    const vulnerable = resolveDamage(100, 'energy', 0, 0, 12, 0, 0.25);
    // Energy is vulnerable through armor: armor reduction * (1 - 0.25) = less reduction
    expect(vulnerable.hullDamage).toBeGreaterThan(normal.hullDamage);
  });

  it('zero damage returns zero results', () => {
    const result = resolveDamage(0, 'energy', 0, 80, 12, 0, 0);
    expect(result.shieldAbsorbed).toBe(0);
    expect(result.hullDamage).toBe(0);
  });

  it('no shield and no armor passes full damage to hull', () => {
    const result = resolveDamage(50, 'kinetic', 0, 0, 0, 0, 0);
    expect(result.shieldAbsorbed).toBe(0);
    expect(result.hullDamage).toBe(50);
  });
});

describe('shield recharge', () => {
  it('recharges shield over time', () => {
    expect(rechargeShield(20, 80, 6, 2)).toBe(32);
  });

  it('clamps to max shield', () => {
    expect(rechargeShield(75, 80, 6, 2)).toBe(80);
  });

  it('does nothing when max shield is zero', () => {
    expect(rechargeShield(0, 0, 6, 2)).toBe(0);
  });

  it('does nothing when recharge rate is zero', () => {
    expect(rechargeShield(40, 80, 0, 2)).toBe(40);
  });
});

function makeModule(id: string, hex: { q: number; r: number }, hp: number, category: string): ModuleRuntimeState {
  return { instanceId: id, definitionId: `test:${id}`, hex, currentHp: hp, maxHp: hp, destroyed: false, category };
}

describe('module damage', () => {
  it('damages the most-aligned module first', () => {
    const modules: ModuleRuntimeState[] = [
      makeModule('front', { q: 0, r: -1 }, 100, 'weapon'),
      makeModule('back', { q: 0, r: 1 }, 100, 'engine'),
    ];
    // Hit from the front (angle 0 = +Z direction, hits hex at r=-1)
    damageModules(modules, 30, 0, 0.6);
    expect(modules[0].currentHp).toBeCloseTo(70, 5);
    expect(modules[1].currentHp).toBe(100);
  });

  it('destroys a module when HP reaches zero', () => {
    const modules: ModuleRuntimeState[] = [
      makeModule('a', { q: 0, r: -1 }, 50, 'weapon'),
    ];
    const destroyed = damageModules(modules, 60, 0, 0.6);
    expect(destroyed).toEqual(['a']);
    expect(modules[0].destroyed).toBe(true);
    expect(modules[0].currentHp).toBe(0);
  });

  it('returns empty array when no modules destroyed', () => {
    const modules: ModuleRuntimeState[] = [
      makeModule('a', { q: 0, r: 0 }, 100, 'weapon'),
    ];
    const destroyed = damageModules(modules, 30, 0, 0.6);
    expect(destroyed).toEqual([]);
    expect(modules[0].destroyed).toBe(false);
  });

  it('armor absorbs a fraction of damage', () => {
    const armor = makeModule('armor', { q: 0, r: -1 }, 100, 'armor');
    const weapon = makeModule('gun', { q: 1, r: 0 }, 100, 'weapon');
    // Armor is in front — it absorbs 60% of the damage
    damageModules([armor, weapon], 50, 0, 0.6);
    // Armor absorbs 50*0.6 = 30, remaining 20 hits primary (armor again)
    expect(armor.currentHp).toBeCloseTo(50, 5);
    expect(weapon.currentHp).toBe(100);
  });

  it('overflow spreads to next aligned module', () => {
    const modules: ModuleRuntimeState[] = [
      makeModule('a', { q: 0, r: -1 }, 20, 'weapon'),
      makeModule('b', { q: 1, r: 0 }, 100, 'hull'),
    ];
    const destroyed = damageModules(modules, 40, Math.PI / 4, 0.6);
    // First module destroyed, 20 overflows to second
    expect(destroyed).toEqual(['a']);
    expect(modules[1].currentHp).toBeCloseTo(80, 5);
  });

  it('skips already-destroyed modules', () => {
    const modules: ModuleRuntimeState[] = [
      { ...makeModule('dead', { q: 0, r: 0 }, 100, 'weapon'), destroyed: true, currentHp: 0 },
      makeModule('alive', { q: 0, r: 1 }, 100, 'engine'),
    ];
    const destroyed = damageModules(modules, 30, Math.PI, 0.6);
    expect(destroyed).toEqual([]);
    expect(modules[1].currentHp).toBeCloseTo(70, 5);
  });

  it('handles zero damage gracefully', () => {
    const modules: ModuleRuntimeState[] = [
      makeModule('a', { q: 0, r: 0 }, 100, 'weapon'),
    ];
    const destroyed = damageModules(modules, 0, 0, 0.6);
    expect(destroyed).toEqual([]);
    expect(modules[0].currentHp).toBe(100);
  });
});
