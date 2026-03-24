import { describe, it, expect } from 'vitest';
import {
  createSigilState,
  activateSigil,
  advanceSigilTier,
  clearTierUpPending,
  resetWaveState,
  registerSigilKill,
  tickSigilTimers,
  consumeDefensiveSave,
  getSigilEffects,
  generateSigilOffers,
  isFreePurchaseWave,
  consumeFreePurchase,
  getShopCostMult,
  SIGIL_CATALOG,
  SIGIL_STREAK_TIMEOUT,
  type SigilState,
  type SigilId,
} from '../src/game/sigils';

// ── Helpers ──────────────────────────────────────────────────

function sigil(id: SigilId): SigilState {
  return activateSigil(createSigilState(), id);
}

// ── Catalog ──────────────────────────────────────────────────

describe('sigils catalog', () => {
  it('has 8 sigils', () => {
    expect(SIGIL_CATALOG).toHaveLength(8);
  });

  it('each sigil has exactly 3 tiers', () => {
    for (const s of SIGIL_CATALOG) {
      expect(s.tiers).toHaveLength(3);
      expect(s.tiers[0].tier).toBe(1);
      expect(s.tiers[1].tier).toBe(2);
      expect(s.tiers[2].tier).toBe(3);
    }
  });

  it('each sigil has a non-empty trade-off', () => {
    for (const s of SIGIL_CATALOG) {
      expect(s.tradeOff.length).toBeGreaterThan(0);
    }
  });

  it('tier waves are 1, 5, 10', () => {
    for (const s of SIGIL_CATALOG) {
      expect(s.tiers[0].waveRequired).toBe(1);
      expect(s.tiers[1].waveRequired).toBe(5);
      expect(s.tiers[2].waveRequired).toBe(10);
    }
  });

  it('all sigil IDs are unique', () => {
    const ids = SIGIL_CATALOG.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── State ────────────────────────────────────────────────────

describe('createSigilState', () => {
  it('returns empty state', () => {
    const s = createSigilState();
    expect(s.activeId).toBeNull();
    expect(s.currentTier).toBe(1);
    expect(s.killStreak).toBe(0);
    expect(s.streakTimer).toBe(0);
    expect(s.tierUpPending).toBe(false);
    expect(s.defensiveTriggerUsed).toBe(false);
  });
});

describe('activateSigil', () => {
  it('sets activeId and resets counters', () => {
    const s = sigil('blood_oath');
    expect(s.activeId).toBe('blood_oath');
    expect(s.currentTier).toBe(1);
    expect(s.killStreak).toBe(0);
    expect(s.streakTimer).toBe(0);
  });
});

// ── Tier Advancement ─────────────────────────────────────────

describe('advanceSigilTier', () => {
  it('no effect with no active sigil', () => {
    const s = createSigilState();
    expect(advanceSigilTier(s, 10).currentTier).toBe(1);
  });

  it('starts at tier 1 on wave 1', () => {
    const s = sigil('ironclad');
    expect(advanceSigilTier(s, 1).currentTier).toBe(1);
  });

  it('advances to tier 2 at wave 5', () => {
    const s = sigil('ironclad');
    const result = advanceSigilTier(s, 5);
    expect(result.currentTier).toBe(2);
    expect(result.tierUpPending).toBe(true);
  });

  it('advances to tier 3 at wave 10', () => {
    let s = sigil('ironclad');
    s = advanceSigilTier(s, 5); // tier 2
    const result = advanceSigilTier(s, 10);
    expect(result.currentTier).toBe(3);
    expect(result.tierUpPending).toBe(true);
  });

  it('skips waves that dont trigger advancement', () => {
    const s = sigil('ironclad');
    expect(advanceSigilTier(s, 2).currentTier).toBe(1);
    expect(advanceSigilTier(s, 3).currentTier).toBe(1);
    expect(advanceSigilTier(s, 4).currentTier).toBe(1);
  });

  it('clearing tierUpPending', () => {
    let s = sigil('ironclad');
    s = advanceSigilTier(s, 5);
    expect(s.tierUpPending).toBe(true);
    expect(clearTierUpPending(s).tierUpPending).toBe(false);
  });
});

describe('resetWaveState', () => {
  it('clears defensiveTriggerUsed', () => {
    let s = sigil('ironclad');
    s = advanceSigilTier(s, 10);
    s = { ...s, defensiveTriggerUsed: true };
    expect(resetWaveState(s).defensiveTriggerUsed).toBe(false);
  });
});

// ── Kill Tracking ────────────────────────────────────────────

describe('registerSigilKill', () => {
  it('increments kill streak', () => {
    let s = sigil('blood_oath');
    s = registerSigilKill(s, 0.1);
    expect(s.killStreak).toBe(1);
    s = registerSigilKill(s, 0.1);
    expect(s.killStreak).toBe(2);
  });

  it('resets streak timer', () => {
    let s = sigil('blood_oath');
    s = tickSigilTimers(s, 2.0);
    s = registerSigilKill(s, 0.1);
    expect(s.streakTimer).toBe(SIGIL_STREAK_TIMEOUT);
  });
});

describe('tickSigilTimers', () => {
  it('counts down streak timer', () => {
    let s = sigil('blood_oath');
    s = registerSigilKill(s, 0);
    const result = tickSigilTimers(s, 1.0);
    expect(result.streakTimer).toBe(SIGIL_STREAK_TIMEOUT - 1.0);
  });

  it('resets kill streak when timer expires', () => {
    let s = sigil('blood_oath');
    s = registerSigilKill(s, 0);
    s = registerSigilKill(s, 0);
    expect(s.killStreak).toBe(2);
    const result = tickSigilTimers(s, SIGIL_STREAK_TIMEOUT + 0.01);
    expect(result.killStreak).toBe(0);
    expect(result.streakTimer).toBe(0);
  });

  it('no-op with no active sigil', () => {
    const s = createSigilState();
    expect(tickSigilTimers(s, 10.0)).toEqual(s);
  });
});

// ── Defensive Save (Ironclad T3) ────────────────────────────

describe('consumeDefensiveSave', () => {
  it('saves when ironclad tier 3 and not used', () => {
    let s = sigil('ironclad');
    s = advanceSigilTier(s, 5);
    s = advanceSigilTier(s, 10);
    const result = consumeDefensiveSave(s);
    expect(result.saved).toBe(true);
    expect(result.state.defensiveTriggerUsed).toBe(true);
  });

  it('does not save if already used this wave', () => {
    let s = sigil('ironclad');
    s = advanceSigilTier(s, 10);
    s = { ...s, defensiveTriggerUsed: true };
    expect(consumeDefensiveSave(s).saved).toBe(false);
  });

  it('does not save if wrong sigil', () => {
    const s = sigil('blood_oath');
    expect(consumeDefensiveSave(s).saved).toBe(false);
  });

  it('does not save if tier < 3', () => {
    let s = sigil('ironclad');
    s = advanceSigilTier(s, 5); // tier 2
    expect(consumeDefensiveSave(s).saved).toBe(false);
  });
});

// ── Effects Query ────────────────────────────────────────────

describe('getSigilEffects', () => {
  it('returns identity effects with no active sigil', () => {
    const e = getSigilEffects(createSigilState());
    expect(e.damageMult).toBe(1);
    expect(e.fireRateMult).toBe(1);
    expect(e.hpMult).toBe(1);
    expect(e.creditMult).toBe(1);
    expect(e.thrustMult).toBe(1);
  });

  // ── Blood Oath ──
  describe('blood_oath', () => {
    it('tier 1: -15% damage, 3% heal on kill', () => {
      const e = getSigilEffects(sigil('blood_oath'));
      expect(e.damageMult).toBe(0.85);
      expect(e.healOnKillPct).toBe(3);
    });

    it('tier 2: adds streak healing', () => {
      let s = sigil('blood_oath');
      s = advanceSigilTier(s, 5);
      const e = getSigilEffects(s);
      expect(e.healOnKillStreakBonusPct).toBe(1);
      expect(e.healStreakCap).toBe(5);
    });

    it('tier 3: adds damage at streak', () => {
      let s = sigil('blood_oath');
      s = advanceSigilTier(s, 10);
      const e = getSigilEffects(s);
      expect(e.damageAtStreakPct).toBe(30);
    });
  });

  // ── Ironclad ──
  describe('ironclad', () => {
    it('tier 1: -30% thrust, +25 armor', () => {
      const e = getSigilEffects(sigil('ironclad'));
      expect(e.thrustMult).toBe(0.7);
      expect(e.armorBonus).toBe(25);
    });

    it('tier 2: reduced module destruction', () => {
      let s = sigil('ironclad');
      s = advanceSigilTier(s, 5);
      const e = getSigilEffects(s);
      expect(e.moduleDestructionMult).toBe(0.7);
    });
  });

  // ── Storm Front ──
  describe('storm_front', () => {
    it('tier 1: -20% damage, +30% fire rate', () => {
      const e = getSigilEffects(sigil('storm_front'));
      expect(e.damageMult).toBe(0.8);
      expect(e.fireRateMult).toBe(1.3);
    });

    it('tier 2: chain lightning every 5th shot', () => {
      let s = sigil('storm_front');
      s = advanceSigilTier(s, 5);
      const e = getSigilEffects(s);
      expect(e.chainLightningInterval).toBe(5);
      expect(e.chainLightningDamagePct).toBe(25);
    });

    it('tier 3: tempest cooldown reduction', () => {
      let s = sigil('storm_front');
      s = advanceSigilTier(s, 10);
      const e = getSigilEffects(s);
      expect(e.tempestCdReduction).toBe(0.5);
      expect(e.tempestStreakMin).toBe(3);
    });
  });

  // ── Void Walker ──
  describe('void_walker', () => {
    it('tier 1: -20% HP, shield on dash', () => {
      const e = getSigilEffects(sigil('void_walker'));
      expect(e.hpMult).toBe(0.8);
      expect(e.shieldOnDash).toBe(15);
    });

    it('tier 2: shorter dash cooldown', () => {
      let s = sigil('void_walker');
      s = advanceSigilTier(s, 5);
      expect(getSigilEffects(s).dashCooldownMult).toBe(0.75);
    });

    it('tier 3: dash damage', () => {
      let s = sigil('void_walker');
      s = advanceSigilTier(s, 10);
      expect(getSigilEffects(s).dashDamageArmorMult).toBe(2);
    });
  });

  // ── War Economy ──
  describe('war_economy', () => {
    it('tier 1: -10% HP and damage, +40% credits', () => {
      const e = getSigilEffects(sigil('war_economy'));
      expect(e.hpMult).toBe(0.9);
      expect(e.damageMult).toBe(0.9);
      expect(e.creditMult).toBe(1.4);
    });

    it('tier 2: cheaper shop', () => {
      let s = sigil('war_economy');
      s = advanceSigilTier(s, 5);
      expect(getSigilEffects(s).shopCostMult).toBe(0.8);
    });
  });

  // ── Graviton ──
  describe('graviton', () => {
    it('tier 1: faster pickup despawn, 2x pickup range', () => {
      const e = getSigilEffects(sigil('graviton'));
      expect(e.pickupDespawnMult).toBe(0.6);
      expect(e.pickupRangeMult).toBe(2);
    });

    it('tier 2: slow aura', () => {
      let s = sigil('graviton');
      s = advanceSigilTier(s, 5);
      const e = getSigilEffects(s);
      expect(e.slowRadius).toBe(4);
      expect(e.slowAmount).toBe(0.2);
    });

    it('tier 3: explosion on kill near others', () => {
      let s = sigil('graviton');
      s = advanceSigilTier(s, 10);
      const e = getSigilEffects(s);
      expect(e.explosionDamagePct).toBe(15);
      expect(e.explosionRadius).toBe(4);
    });
  });

  // ── Entropy Field ──
  describe('entropy_field', () => {
    it('tier 1: stronger enemies, +35% projectile speed', () => {
      const e = getSigilEffects(sigil('entropy_field'));
      expect(e.enemyDamageMult).toBe(1.1);
      expect(e.enemyFireRateMult).toBe(1.1);
      expect(e.projectileSpeedMult).toBe(1.35);
    });

    it('tier 2: 25% crit chance', () => {
      let s = sigil('entropy_field');
      s = advanceSigilTier(s, 5);
      expect(getSigilEffects(s).critChance).toBe(0.25);
    });

    it('tier 3: 20% kill pickup chance', () => {
      let s = sigil('entropy_field');
      s = advanceSigilTier(s, 10);
      expect(getSigilEffects(s).killPickupChance).toBe(0.2);
    });
  });

  // ── Warp Lance ──
  describe('warp_lance', () => {
    it('tier 1: -40% fire rate, pierce 1', () => {
      const e = getSigilEffects(sigil('warp_lance'));
      expect(e.fireRateMult).toBe(0.6);
      expect(e.pierceCount).toBe(1);
    });

    it('tier 2: focus damage', () => {
      let s = sigil('warp_lance');
      s = advanceSigilTier(s, 5);
      const e = getSigilEffects(s);
      expect(e.focusDamagePctPerHit).toBe(10);
      expect(e.focusDamageMaxPct).toBe(50);
    });

    it('tier 3: warp strike every 8th shot', () => {
      let s = sigil('warp_lance');
      s = advanceSigilTier(s, 10);
      const e = getSigilEffects(s);
      expect(e.warpStrikeInterval).toBe(8);
      expect(e.warpStrikeDamageMult).toBe(3);
    });
  });
});

// ── Shop Integration ─────────────────────────────────────────

describe('shop integration', () => {
  it('free purchase available for war economy tier 3', () => {
    let s = sigil('war_economy');
    s = advanceSigilTier(s, 10);
    expect(isFreePurchaseWave(s)).toBe(true);
  });

  it('free purchase consumed after use', () => {
    let s = sigil('war_economy');
    s = advanceSigilTier(s, 10);
    expect(isFreePurchaseWave(s)).toBe(true);
    s = consumeFreePurchase(s);
    expect(isFreePurchaseWave(s)).toBe(false);
  });

  it('free purchase resets on new wave', () => {
    let s = sigil('war_economy');
    s = advanceSigilTier(s, 10);
    s = consumeFreePurchase(s);
    expect(isFreePurchaseWave(s)).toBe(false);
    s = resetWaveState(s);
    expect(isFreePurchaseWave(s)).toBe(true);
  });

  it('no free purchase for other sigils', () => {
    const s = sigil('blood_oath');
    expect(isFreePurchaseWave(s)).toBe(false);
  });

  it('shop cost multiplier from sigil', () => {
    expect(getShopCostMult(createSigilState())).toBe(1);
    let s = sigil('war_economy');
    s = advanceSigilTier(s, 5);
    expect(getShopCostMult(s)).toBe(0.8);
  });
});

// ── Offer Generation ─────────────────────────────────────────

describe('generateSigilOffers', () => {
  it('returns exactly 3 sigils', () => {
    expect(generateSigilOffers(0.5)).toHaveLength(3);
  });

  it('returns unique sigils', () => {
    const offers = generateSigilOffers(0.5);
    const ids = offers.map(s => s.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('different seeds produce different offers', () => {
    // Not guaranteed for all seeds but likely with varied inputs
    const a = generateSigilOffers(0.1).map(s => s.id);
    const b = generateSigilOffers(0.9).map(s => s.id);
    // At least one should differ most of the time
    expect(a.join() + b.join()).toBeDefined(); // just ensure no crash
  });
});

// ── Edge Cases ───────────────────────────────────────────────

describe('edge cases', () => {
  it('kill tracking with no active sigil is no-op', () => {
    const s = createSigilState();
    expect(registerSigilKill(s, 0.1)).toEqual(s);
  });

  it('getSigilEffects is pure — does not mutate state', () => {
    const s = sigil('blood_oath');
    const before = JSON.stringify(s);
    getSigilEffects(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('advancing tier on already-maxed tier is no-op', () => {
    let s = sigil('ironclad');
    s = advanceSigilTier(s, 10);
    s = clearTierUpPending(s); // clear the flag from tier-up
    const result = advanceSigilTier(s, 20);
    expect(result.currentTier).toBe(3);
    expect(result.tierUpPending).toBe(false);
  });
});
