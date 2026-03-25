import { describe, it, expect } from 'vitest';
import {
  rollPickupDrop,
  createPickup,
  updatePickup,
  tryCollectPickup,
  applyRepair,
  updateBuffs,
  getDamageMultiplier,
  getCadenceMultiplier,
} from '../src/game/pickups';
import type { ModuleRuntimeState } from '../src/game/simulation';
import {
  defaultLiveUpgradeStats,
  generateUpgradeOptions,
  upgradeCost,
  getUpgradeOfferCost,
  applyUpgrade,
  applyAllUpgrades,
  UPGRADE_CATALOG,
  type PurchasedUpgrade,
  type LiveUpgradeStats,
} from '../src/game/upgrade-shop';

// ── Pickup Tests ────────────────────────────────────────────────

describe('pickups', () => {
  describe('rollPickupDrop', () => {
    it('returns null sometimes based on drop rate', () => {
      let nullCount = 0;
      for (let i = 0; i < 200; i++) {
        if (rollPickupDrop(1, 1) === null) nullCount++;
      }
      // Base drop rate is 35%, so should get some nulls
      expect(nullCount).toBeGreaterThan(50);
    });

    it('returns a valid PickupKind when not null', () => {
      const validKinds = ['shield_cell', 'repair_kit', 'power_surge', 'rapid_fire', 'salvage'];
      for (let i = 0; i < 100; i++) {
        const kind = rollPickupDrop(1, 10);
        if (kind !== null) {
          expect(validKinds).toContain(kind);
        }
      }
    });

    it('salvage is rarer than shield_cell', () => {
      let shieldCount = 0;
      let salvageCount = 0;
      for (let i = 0; i < 2000; i++) {
        const kind = rollPickupDrop(1, 1);
        if (kind === 'shield_cell') shieldCount++;
        if (kind === 'salvage') salvageCount++;
      }
      expect(shieldCount).toBeGreaterThan(salvageCount);
    });
  });

  describe('createPickup', () => {
    it('creates a pickup with correct initial state', () => {
      const pickup = createPickup('shield_cell', 5, 3);
      expect(pickup.kind).toBe('shield_cell');
      expect(pickup.active).toBe(true);
      expect(pickup.ttl).toBe(12);
      expect(pickup.maxTtl).toBe(12);
      expect(pickup.id).toMatch(/^pickup-\d+$/);
    });
  });

  describe('updatePickup', () => {
    it('decrements TTL', () => {
      const pickup = createPickup('shield_cell', 0, 0);
      const updated = updatePickup(pickup, 1);
      expect(updated.ttl).toBe(11);
    });

    it('deactivates when TTL reaches 0', () => {
      const pickup = createPickup('shield_cell', 0, 0);
      let updated = pickup;
      for (let i = 0; i < 13; i++) {
        updated = updatePickup(updated, 1);
      }
      expect(updated.active).toBe(false);
      expect(updated.ttl).toBeLessThanOrEqual(0);
    });

    it('advances bob phase', () => {
      const pickup = createPickup('shield_cell', 0, 0);
      const updated = updatePickup(pickup, 1);
      expect(updated.bobPhase).not.toBe(pickup.bobPhase);
    });
  });

  describe('tryCollectPickup', () => {
    const fakeModules: ModuleRuntimeState[] = [
      {
        instanceId: 'hull-1',
        definitionId: 'core:hull_1x1',
        hex: { q: 0, r: 0 },
        currentHp: 30,
        maxHp: 50,
        destroyed: false,
        category: 'hull',
      },
    ];

    it('collects when within range', () => {
      const pickup = createPickup('shield_cell', 0.5, 0.5);
      // Override position to known location for deterministic test
      pickup.x = 0.1;
      pickup.z = 0.1;
      const result = tryCollectPickup(pickup, 0, 0, 100, fakeModules);
      expect(result.collected).toBe(true);
      expect(result.shieldRestore).toBeGreaterThan(0);
    });

    it('does not collect when out of range', () => {
      const pickup = createPickup('shield_cell', 10, 10);
      const result = tryCollectPickup(pickup, 0, 0, 100, fakeModules);
      expect(result.collected).toBe(false);
    });

    it('shield_cell restores 30% of max shield', () => {
      const pickup = createPickup('shield_cell', 0, 0);
      const result = tryCollectPickup(pickup, 0, 0, 200, fakeModules);
      expect(result.collected).toBe(true);
      expect(result.shieldRestore).toBeCloseTo(60, 0);
    });

    it('power_surge grants a buff', () => {
      const pickup = createPickup('power_surge', 0, 0);
      const result = tryCollectPickup(pickup, 0, 0, 100, fakeModules);
      expect(result.collected).toBe(true);
      expect(result.buffGained).not.toBeNull();
      expect(result.buffGained!.kind).toBe('power_surge');
    });

    it('rapid_fire grants a buff', () => {
      const pickup = createPickup('rapid_fire', 0, 0);
      const result = tryCollectPickup(pickup, 0, 0, 100, fakeModules);
      expect(result.collected).toBe(true);
      expect(result.buffGained!.kind).toBe('rapid_fire');
    });

    it('does not collect inactive pickup', () => {
      const pickup = createPickup('shield_cell', 0, 0);
      pickup.active = false;
      const result = tryCollectPickup(pickup, 0, 0, 100, fakeModules);
      expect(result.collected).toBe(false);
    });
  });

  describe('applyRepair', () => {
    it('repairs a damaged module to 75%', () => {
      const module: ModuleRuntimeState = {
        instanceId: 'hull-1',
        definitionId: 'core:hull_1x1',
        hex: { q: 0, r: 0 },
        currentHp: 20,
        maxHp: 100,
        destroyed: false,
        category: 'hull',
      };
      const repaired = applyRepair(module, 0.75);
      expect(repaired.destroyed).toBe(false);
      expect(repaired.currentHp).toBe(75);
    });

    it('revives a destroyed module at full HP when fraction=1', () => {
      const module: ModuleRuntimeState = {
        instanceId: 'hull-1',
        definitionId: 'core:hull_1x1',
        hex: { q: 0, r: 0 },
        currentHp: 0,
        maxHp: 100,
        destroyed: true,
        category: 'hull',
      };
      const repaired = applyRepair(module, 1.0);
      expect(repaired.destroyed).toBe(false);
      expect(repaired.currentHp).toBe(100);
    });
  });

  describe('buffs', () => {
    it('damage multiplier is 1.4 with power_surge', () => {
      expect(getDamageMultiplier([{ kind: 'power_surge', remaining: 5, duration: 6 }])).toBe(1.4);
    });

    it('cadence multiplier is 1.5 with rapid_fire', () => {
      expect(getCadenceMultiplier([{ kind: 'rapid_fire', remaining: 3, duration: 5 }])).toBe(1.5);
    });

    it('no buffs = multipliers of 1', () => {
      expect(getDamageMultiplier([])).toBe(1);
      expect(getCadenceMultiplier([])).toBe(1);
    });

    it('updateBuffs removes expired buffs', () => {
      const buffs = [
        { kind: 'power_surge' as const, remaining: 0.5, duration: 6 },
        { kind: 'rapid_fire' as const, remaining: 2, duration: 5 },
      ];
      const updated = updateBuffs(buffs, 1);
      expect(updated).toHaveLength(1);
      expect(updated[0].kind).toBe('rapid_fire');
    });
  });
});

// ── Upgrade Shop Tests ──────────────────────────────────────────

describe('upgrade-shop', () => {
  describe('defaultLiveUpgradeStats', () => {
    it('returns stats with neutral multipliers', () => {
      const stats = defaultLiveUpgradeStats();
      expect(stats.damageMultiplier).toBe(1);
      expect(stats.fireRateMultiplier).toBe(1);
      expect(stats.buffDurationBonus).toBe(1);
      expect(stats.maxHpBonus).toBe(0);
    });
  });

  describe('UPGRADE_CATALOG', () => {
    it('has upgrades across all categories', () => {
      const categories = new Set(UPGRADE_CATALOG.map((u) => u.category));
      expect(categories).toContain('offensive');
      expect(categories).toContain('defensive');
      expect(categories).toContain('utility');
      expect(categories).toContain('special');
    });

    it('has upgrades across all rarities', () => {
      const rarities = new Set(UPGRADE_CATALOG.map((u) => u.rarity));
      expect(rarities).toContain('common');
      expect(rarities).toContain('uncommon');
      expect(rarities).toContain('rare');
    });

    it('all upgrades have unique ids', () => {
      const ids = UPGRADE_CATALOG.map((u) => u.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all upgrades have waveMin >= 1', () => {
      for (const u of UPGRADE_CATALOG) {
        expect(u.waveMin).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('generateUpgradeOptions', () => {
    it('returns up to 3 options', () => {
      const options = generateUpgradeOptions(1, []);
      expect(options.length).toBeLessThanOrEqual(3);
      expect(options.length).toBeGreaterThan(0);
    });

    it('does not include already purchased upgrades', () => {
      const purchased: PurchasedUpgrade[] = [
        { def: UPGRADE_CATALOG[0], wavePurchased: 1 },
        { def: UPGRADE_CATALOG[1], wavePurchased: 2 },
      ];
      const options = generateUpgradeOptions(5, purchased);
      const purchasedIds = new Set(purchased.map((p) => p.def.id));
      for (const opt of options) {
        expect(purchasedIds.has(opt.id)).toBe(false);
      }
    });

    it('respects waveMin for availability', () => {
      // Wave 1 should not include upgrades with waveMin > 1
      const options = generateUpgradeOptions(1, []);
      for (const opt of options) {
        expect(opt.waveMin).toBeLessThanOrEqual(1);
      }
    });

    it('returns empty when all upgrades purchased', () => {
      const purchased: PurchasedUpgrade[] = UPGRADE_CATALOG.map((u, i) => ({
        def: u,
        wavePurchased: i + 1,
      }));
      const options = generateUpgradeOptions(50, purchased);
      expect(options).toHaveLength(0);
    });

    it('returns no duplicates', () => {
      const ids = new Set(generateUpgradeOptions(10, []).map((o) => o.id));
      expect(ids.size).toBe(generateUpgradeOptions(10, []).length);
    });
  });

  describe('upgradeCost', () => {
    it('scales with wave number', () => {
      const upgrade = UPGRADE_CATALOG[0]; // reinforced_cannon, cost 40
      const cost1 = upgradeCost(upgrade, 1);
      const cost10 = upgradeCost(upgrade, 10);
      expect(cost10).toBeGreaterThan(cost1);
    });

    it('base cost matches at waveMin', () => {
      for (const u of UPGRADE_CATALOG) {
        const cost = upgradeCost(u, u.waveMin);
        // At waveMin, scaling factor is 1
        expect(cost).toBe(u.cost);
      }
    });
  });

  describe('getUpgradeOfferCost', () => {
    it('applies crisis and sigil discounts before the free purchase check', () => {
      expect(getUpgradeOfferCost({
        baseCost: 100,
        crisisCostReduction: 0.2,
        sigilCostMult: 0.9,
        hasFreePurchase: false,
      })).toEqual({ cost: 72, isFree: false, consumesFreePurchase: false });
    });

    it('marks discounted offers as free when a free purchase is available', () => {
      expect(getUpgradeOfferCost({
        baseCost: 100,
        crisisCostReduction: 0.1,
        sigilCostMult: 1,
        hasFreePurchase: true,
      })).toEqual({ cost: 0, isFree: true, consumesFreePurchase: true });
    });

    it('does not consume a free purchase when discounts already reduce cost to zero', () => {
      expect(getUpgradeOfferCost({
        baseCost: 10,
        crisisCostReduction: 1,
        sigilCostMult: 1,
        hasFreePurchase: true,
      })).toEqual({ cost: 0, isFree: true, consumesFreePurchase: false });
    });
  });

  describe('applyUpgrade', () => {
    it('adds hull bonus', () => {
      const stats = defaultLiveUpgradeStats();
      const hullUpgrade = UPGRADE_CATALOG.find((u) => u.id === 'hull_reinforcement')!;
      const result = applyUpgrade(stats, hullUpgrade);
      expect(result.maxHpBonus).toBe(40);
    });

    it('stacks damage multipliers', () => {
      const stats = defaultLiveUpgradeStats();
      const cannonUpgrade = UPGRADE_CATALOG.find((u) => u.id === 'reinforced_cannon')!;
      let result = applyUpgrade(stats, cannonUpgrade);
      expect(result.damageMultiplier).toBeCloseTo(1.15);
      result = applyUpgrade(result, cannonUpgrade);
      expect(result.damageMultiplier).toBeCloseTo(1.15 * 1.15);
    });
  });

  describe('applyAllUpgrades', () => {
    it('applies all purchased upgrades in order', () => {
      const purchased: PurchasedUpgrade[] = [
        { def: UPGRADE_CATALOG.find((u) => u.id === 'hull_reinforcement')!, wavePurchased: 1 },
        { def: UPGRADE_CATALOG.find((u) => u.id === 'thruster_boost')!, wavePurchased: 2 },
      ];
      const stats = applyAllUpgrades(purchased);
      expect(stats.maxHpBonus).toBe(40);
      expect(stats.thrustBonus).toBe(0.15);
    });

    it('returns default stats when no upgrades purchased', () => {
      const stats = applyAllUpgrades([]);
      expect(stats).toEqual(defaultLiveUpgradeStats());
    });
  });
});
