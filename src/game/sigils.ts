// ── Pilot Sigils — Run Identity System ─────────────────────────
//
// Before each endless run, the player chooses a Pilot Sigil from 3
// random options. Each sigil has 3 tiers that unlock at waves 1, 5,
// and 10, creating escalating build identity throughout the run.
//
// Sigils are the single "what kind of run is this?" choice that makes
// every run feel different from wave 1. They compose with mutators,
// mutagen, crisis events, crew orders, and every other system.
//
// Design principles:
// 1. Each tier is a meaningful power shift, not a stat bump
// 2. Every sigil has a trade-off — no pure upside
// 3. Tier 3 creates a new gameplay behavior, not just bigger numbers
// 4. Different sigils want different complementary systems
//
// Pure logic — no Three.js imports.

// ── Types ─────────────────────────────────────────────────────

export type SigilId =
  | 'blood_oath'
  | 'ironclad'
  | 'storm_front'
  | 'void_walker'
  | 'war_economy'
  | 'graviton'
  | 'entropy_field'
  | 'warp_lance';

export type SigilTier = 1 | 2 | 3;

export interface SigilTierDef {
  tier: SigilTier;
  waveRequired: number;
  /** Short display name for this tier. */
  name: string;
  /** One-line description of the tier effect. */
  description: string;
  /** Flavor text. */
  flavor: string;
}

export interface SigilDef {
  id: SigilId;
  displayName: string;
  icon: string;
  /** Theme color for UI chrome. */
  color: string;
  /** Short description of the sigil's overall theme. */
  tagline: string;
  /** The trade-off — what you give up. */
  tradeOff: string;
  tiers: SigilTierDef[];
}

export interface SigilState {
  /** Which sigil is active, or null if none chosen. */
  activeId: SigilId | null;
  /** Current unlocked tier (1, 2, or 3). */
  currentTier: SigilTier;
  /** Whether a tier-up announcement should fire. */
  tierUpPending: boolean;
  /** Kill counter for sigils that track kill streaks. */
  killStreak: number;
  /** Seconds since last kill (for streak reset). */
  streakTimer: number;
  /** Whether the tier-3 defensive trigger is available this wave. */
  defensiveTriggerUsed: boolean;
}

// ── Constants ─────────────────────────────────────────────────

export const SIGIL_TIER_WAVES: Record<SigilTier, number> = {
  1: 1,
  2: 5,
  3: 10,
};

export const SIGIL_STREAK_TIMEOUT = 4.0;

// ── Sigil Catalog ─────────────────────────────────────────────

export const SIGIL_CATALOG: SigilDef[] = [
  {
    id: 'blood_oath',
    displayName: 'Blood Oath',
    icon: '🩸',
    color: '#ef4444',
    tagline: 'Violence sustains you',
    tradeOff: '-15% damage dealt',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Siphon', description: 'Kills restore 3% max HP', flavor: 'The void thirsts.' },
      { tier: 2, waveRequired: 5, name: 'Frenzy', description: 'Kill streaks boost healing: +1% per streak kill (up to +5%)', flavor: 'Your blood runs hot.' },
      { tier: 3, waveRequired: 10, name: 'Crimson Surge', description: 'At 5+ kill streak, gain +30% damage (offsetting the trade-off)', flavor: 'The pact is sealed.' },
    ],
  },
  {
    id: 'ironclad',
    displayName: 'Ironclad',
    icon: '🛡️',
    color: '#64748b',
    tagline: 'Unbreakable, unstoppable',
    tradeOff: '-30% thrust',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Fortify', description: '+25% armor rating', flavor: 'Steel will.' },
      { tier: 2, waveRequired: 5, name: 'Bastion', description: 'Module destruction damage reduced by 30%', flavor: 'They cannot break what will not bend.' },
      { tier: 3, waveRequired: 10, name: 'Last Stand', description: 'Once per wave, survive a lethal hit at 1 HP', flavor: 'Death is a suggestion.' },
    ],
  },
  {
    id: 'storm_front',
    displayName: 'Storm Front',
    icon: '⚡',
    color: '#fbbf24',
    tagline: 'Speed is firepower',
    tradeOff: '-20% projectile damage',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Overcharge', description: '+30% fire rate', flavor: 'More bullets, more problems solved.' },
      { tier: 2, waveRequired: 5, name: 'Chain Lightning', description: 'Every 5th shot chains to a nearby enemy for 25% damage', flavor: 'The storm finds its mark.' },
      { tier: 3, waveRequired: 10, name: 'Tempest', description: 'Kill streaks of 3+ reduce all ability cooldowns by 0.5s per kill', flavor: 'The storm feeds itself.' },
    ],
  },
  {
    id: 'void_walker',
    displayName: 'Void Walker',
    icon: '🌀',
    color: '#a855f7',
    tagline: 'Phase through danger',
    tradeOff: '-20% max HP',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Phase Shift', description: 'Dash grants 2s of 15 shield (does not stack)', flavor: 'Blink and you miss me.' },
      { tier: 2, waveRequired: 5, name: 'Slipstream', description: 'Dash cooldown reduced by 25%', flavor: 'There is no here.' },
      { tier: 3, waveRequired: 10, name: 'Event Horizon', description: 'Dashing through enemies deals damage equal to 2x your armor', flavor: 'The void consumes all.' },
    ],
  },
  {
    id: 'war_economy',
    displayName: 'War Economy',
    icon: '💰',
    color: '#22c55e',
    tagline: 'Profit from conflict',
    tradeOff: '-10% max HP, -10% damage',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Dividends', description: '+40% credits earned per wave', flavor: 'War is a business.' },
      { tier: 2, waveRequired: 5, name: 'Market Advantage', description: 'Shop upgrades cost 20% less', flavor: 'Buy low, sell high.' },
      { tier: 3, waveRequired: 10, name: 'War Chest', description: 'First shop purchase each wave is free', flavor: 'The house always wins.' },
    ],
  },
  {
    id: 'graviton',
    displayName: 'Graviton',
    icon: '🔮',
    color: '#06b6d4',
    tagline: 'Control the battlefield',
    tradeOff: 'Pickups despawn 40% faster',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Gravity Well', description: '2x pickup attraction range', flavor: 'Everything comes to you.' },
      { tier: 2, waveRequired: 5, name: 'Singularity', description: 'Enemies within 4 units move 20% slower toward you', flavor: 'Resistance is futile.' },
      { tier: 3, waveRequired: 10, name: 'Orbital Bombardment', description: 'Enemies killed near other enemies deal 15% explosion damage to neighbors', flavor: 'The cosmos reclaims its own.' },
    ],
  },
  {
    id: 'entropy_field',
    displayName: 'Entropy Field',
    icon: '☢️',
    color: '#f97316',
    tagline: 'Embrace chaos',
    tradeOff: 'Enemies gain +10% damage and fire rate',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Disorder', description: '+35% projectile speed', flavor: 'Faster chaos.' },
      { tier: 2, waveRequired: 5, name: 'Cascade', description: 'Critical hits (25% chance) deal 2x damage', flavor: 'One push and it all falls.' },
      { tier: 3, waveRequired: 10, name: 'Chain Reaction', description: 'Killing an enemy has 20% chance to spawn a free pickup', flavor: 'From destruction, abundance.' },
    ],
  },
  {
    id: 'warp_lance',
    displayName: 'Warp Lance',
    icon: '🔱',
    color: '#ec4899',
    tagline: 'One shot, one kill',
    tradeOff: '-40% fire rate',
    tiers: [
      { tier: 1, waveRequired: 1, name: 'Piercing', description: 'Projectiles pass through 1 additional enemy', flavor: 'Through and through.' },
      { tier: 2, waveRequired: 5, name: 'Focus', description: 'Damage increases by 10% per consecutive hit on same target (max +50%)', flavor: 'Lock on.' },
      { tier: 3, waveRequired: 10, name: 'Warp Strike', description: 'Every 8th shot teleports to target dealing 3x damage', flavor: 'Nowhere to hide.' },
    ],
  },
];

const SIGIL_BY_ID = Object.fromEntries(SIGIL_CATALOG.map((s) => [s.id, s])) as Record<SigilId, SigilDef>;

export function getSigilDef(id: SigilId): SigilDef | undefined {
  return SIGIL_BY_ID[id];
}

// ── State Management ──────────────────────────────────────────

export function createSigilState(): SigilState {
  return {
    activeId: null,
    currentTier: 1,
    tierUpPending: false,
    killStreak: 0,
    streakTimer: 0,
    defensiveTriggerUsed: false,
  };
}

export function activateSigil(state: SigilState, sigilId: SigilId): SigilState {
  return {
    ...state,
    activeId: sigilId,
    currentTier: 1,
    tierUpPending: false,
    killStreak: 0,
    streakTimer: 0,
    defensiveTriggerUsed: false,
  };
}

/** Check and advance sigil tier based on current wave. Returns new state. */
export function advanceSigilTier(state: SigilState, waveNumber: number): SigilState {
  if (!state.activeId) return state;
  const def = getSigilDef(state.activeId);
  if (!def) return state;

  let newTier = state.currentTier;
  for (const tierDef of def.tiers) {
    if (tierDef.waveRequired <= waveNumber && tierDef.tier > newTier) {
      newTier = tierDef.tier;
    }
  }
  if (newTier === state.currentTier) return state;

  return {
    ...state,
    currentTier: newTier,
    tierUpPending: true,
    defensiveTriggerUsed: false, // reset per-tier for Ironclad
  };
}

/** Clear the tier-up flag after the announcement has been shown. */
export function clearTierUpPending(state: SigilState): SigilState {
  return { ...state, tierUpPending: false };
}

/** Reset defensive trigger at the start of each wave (for Ironclad tier 3). */
export function resetWaveState(state: SigilState): SigilState {
  return { ...state, defensiveTriggerUsed: false };
}

// ── Kill Tracking ────────────────────────────────────────────

export function registerSigilKill(state: SigilState, dt: number): SigilState {
  if (!state.activeId) return state;
  return {
    ...state,
    killStreak: state.killStreak + 1,
    streakTimer: SIGIL_STREAK_TIMEOUT,
  };
}

export function tickSigilTimers(state: SigilState, dt: number): SigilState {
  if (!state.activeId) return state;
  if (state.streakTimer <= 0) return state;
  const newTimer = state.streakTimer - dt;
  return {
    ...state,
    streakTimer: Math.max(0, newTimer),
    killStreak: newTimer <= 0 ? 0 : state.killStreak,
  };
}

/** Consume the Ironclad tier-3 defensive save. Returns true if it was available. */
export function consumeDefensiveSave(state: SigilState): { state: SigilState; saved: boolean } {
  if (state.activeId !== 'ironclad' || state.currentTier < 3 || state.defensiveTriggerUsed) {
    return { state, saved: false };
  }
  return { state: { ...state, defensiveTriggerUsed: true }, saved: true };
}

// ── Effect Queries ───────────────────────────────────────────
//
// These are called every frame / every event to determine what
// the sigil is currently doing. Each returns 0 or false for no effect.

export interface SigilEffects {
  // ── Passive stat modifiers (applied at run start) ──
  damageMult: number;            // multiplied with player damage
  armorBonus: number;            // added to armor rating
  thrustMult: number;            // multiplied with thrust
  fireRateMult: number;          // multiplied with fire rate
  hpMult: number;               // multiplied with max HP
  creditMult: number;            // multiplied with wave credits
  shopCostMult: number;          // multiplied with shop prices (< 1 = cheaper)
  pickupRangeMult: number;      // multiplied with pickup attraction range
  pickupDespawnMult: number;    // multiplied with pickup despawn timer (< 1 = faster)
  projectileSpeedMult: number;   // multiplied with projectile speed
  dashCooldownMult: number;      // multiplied with dash cooldown (< 1 = shorter)
  enemyDamageMult: number;       // applied to ALL enemy damage (if > 1, harder)
  enemyFireRateMult: number;     // applied to ALL enemy fire rate (if > 1, harder)
  moduleDestructionMult: number; // damage taken by modules (< 1 = less)

  // ── Event-driven effects (checked per-kill / per-hit / per-dash) ──
  healOnKillPct: number;             // % of max HP healed per kill
  healOnKillStreakBonusPct: number;  // additional % per streak kill (capped)
  healStreakCap: number;             // streak kills at which bonus caps
  damageAtStreakPct: number;         // at killStreak >= healStreakCap, +damage%
  shieldOnDash: number;              // shield gained on dash
  dashDamageArmorMult: number;       // dash-through damage = armor * this
  critChance: number;                // 0-1 chance for 2x damage
  killPickupChance: number;          // 0-1 chance to spawn pickup on kill
  chainLightningInterval: number;    // every Nth shot chains (0 = disabled)
  chainLightningDamagePct: number;   // chain damage as % of shot damage
  pierceCount: number;               // extra targets projectiles pass through
  focusDamagePctPerHit: number;      // +damage% per consecutive hit on same target
  focusDamageMaxPct: number;         // cap on focus damage bonus
  warpStrikeInterval: number;        // every Nth shot is a warp strike
  warpStrikeDamageMult: number;      // warp strike damage multiplier
  slowRadius: number;               // units within which enemies are slowed
  slowAmount: number;               // fraction of speed reduction (0-1)
  explosionDamagePct: number;       // % of killed enemy HP dealt to neighbors
  explosionRadius: number;          // radius for explosion damage
  tempestCdReduction: number;        // seconds of CD reduction per streak kill
  tempestStreakMin: number;          // minimum streak for tempest to trigger
}

export function getSigilEffects(state: SigilState): SigilEffects {
  const base: SigilEffects = {
    damageMult: 1,
    armorBonus: 0,
    thrustMult: 1,
    fireRateMult: 1,
    hpMult: 1,
    creditMult: 1,
    shopCostMult: 1,
    pickupRangeMult: 1,
    pickupDespawnMult: 1,
    projectileSpeedMult: 1,
    dashCooldownMult: 1,
    enemyDamageMult: 1,
    enemyFireRateMult: 1,
    moduleDestructionMult: 1,
    healOnKillPct: 0,
    healOnKillStreakBonusPct: 0,
    healStreakCap: 999,
    damageAtStreakPct: 0,
    shieldOnDash: 0,
    dashDamageArmorMult: 0,
    critChance: 0,
    killPickupChance: 0,
    chainLightningInterval: 0,
    chainLightningDamagePct: 0,
    pierceCount: 0,
    focusDamagePctPerHit: 0,
    focusDamageMaxPct: 0,
    warpStrikeInterval: 0,
    warpStrikeDamageMult: 1,
    slowRadius: 0,
    slowAmount: 0,
    explosionDamagePct: 0,
    explosionRadius: 0,
    tempestCdReduction: 0,
    tempestStreakMin: 999,
  };

  if (!state.activeId) return base;

  const tier = state.currentTier;

  switch (state.activeId) {
    case 'blood_oath':
      base.damageMult = 0.85; // trade-off: -15% damage
      if (tier >= 1) base.healOnKillPct = 3;
      if (tier >= 2) {
        base.healOnKillStreakBonusPct = 1;
        base.healStreakCap = 5;
      }
      if (tier >= 3) {
        base.damageAtStreakPct = 30;
        base.healStreakCap = 5;
      }
      break;

    case 'ironclad':
      base.thrustMult = 0.7; // trade-off: -30% thrust
      if (tier >= 1) base.armorBonus = 25;
      if (tier >= 2) base.moduleDestructionMult = 0.7;
      // tier 3 is event-driven (consumeDefensiveSave) — no passive effect
      break;

    case 'storm_front':
      base.damageMult = 0.8; // trade-off: -20% damage
      if (tier >= 1) base.fireRateMult = 1.3;
      if (tier >= 2) {
        base.chainLightningInterval = 5;
        base.chainLightningDamagePct = 25;
      }
      if (tier >= 3) {
        base.tempestCdReduction = 0.5;
        base.tempestStreakMin = 3;
      }
      break;

    case 'void_walker':
      base.hpMult = 0.8; // trade-off: -20% max HP
      if (tier >= 1) base.shieldOnDash = 15;
      if (tier >= 2) base.dashCooldownMult = 0.75;
      if (tier >= 3) base.dashDamageArmorMult = 2;
      break;

    case 'war_economy':
      base.hpMult = 0.9;       // trade-off: -10% HP
      base.damageMult = 0.9;    // trade-off: -10% damage
      if (tier >= 1) base.creditMult = 1.4;
      if (tier >= 2) base.shopCostMult = 0.8;
      // tier 3 is handled at shop purchase time
      break;

    case 'graviton':
      base.pickupDespawnMult = 0.6; // trade-off: faster despawn
      if (tier >= 1) base.pickupRangeMult = 2;
      if (tier >= 2) {
        base.slowRadius = 4;
        base.slowAmount = 0.2;
      }
      if (tier >= 3) {
        base.explosionDamagePct = 15;
        base.explosionRadius = 4;
      }
      break;

    case 'entropy_field':
      base.enemyDamageMult = 1.1;   // trade-off: enemies hit harder
      base.enemyFireRateMult = 1.1; // trade-off: enemies shoot faster
      if (tier >= 1) base.projectileSpeedMult = 1.35;
      if (tier >= 2) base.critChance = 0.25;
      if (tier >= 3) base.killPickupChance = 0.2;
      break;

    case 'warp_lance':
      base.fireRateMult = 0.6; // trade-off: -40% fire rate
      if (tier >= 1) base.pierceCount = 1;
      if (tier >= 2) {
        base.focusDamagePctPerHit = 10;
        base.focusDamageMaxPct = 50;
      }
      if (tier >= 3) {
        base.warpStrikeInterval = 8;
        base.warpStrikeDamageMult = 3;
      }
      break;
  }

  return base;
}

// ── Offer Generation ─────────────────────────────────────────
//
// Generate 3 random sigil options for the player to choose from.

export function generateSigilOffers(rng: number = Math.random()): SigilDef[] {
  // Fisher-Yates shuffle, take first 3
  const pool = [...SIGIL_CATALOG];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

// ── Shop Integration ─────────────────────────────────────────

/** Whether the first shop purchase this wave should be free (War Economy tier 3). */
export function isFreePurchaseWave(state: SigilState): boolean {
  return state.activeId === 'war_economy' && state.currentTier >= 3 && !state.defensiveTriggerUsed;
}

/** Mark that the free purchase has been used this wave. */
export function consumeFreePurchase(state: SigilState): SigilState {
  return { ...state, defensiveTriggerUsed: true };
}

/** Apply shop cost multiplier from sigil effects. */
export function getShopCostMult(state: SigilState): number {
  return getSigilEffects(state).shopCostMult;
}
