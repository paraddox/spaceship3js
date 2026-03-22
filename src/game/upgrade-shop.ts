// ── Between-Wave Upgrade Shop ──────────────────────────────────
//
// Roguelike upgrade selection between endless mode waves.
// After clearing each wave, the player is offered 3 random upgrades
// to choose from. Each upgrade modifies the player ship's stats
// for the remainder of the run.
//
// Upgrade categories:
// - Offensive: damage, fire rate, projectile speed, new weapon type
// - Defensive: hull repair, shield boost, armor, damage reduction
// - Utility: thrust, cooling, power, module repair
// - Special: drone capacity, pickup magnet range, buff duration
//
// Upgrade costs scale with wave number and rarity.

export type UpgradeRarity = 'common' | 'uncommon' | 'rare';
export type UpgradeCategory = 'offensive' | 'defensive' | 'utility' | 'special';

export interface UpgradeDef {
  id: string;
  displayName: string;
  description: string;
  icon: string;             // single emoji for UI
  category: UpgradeCategory;
  rarity: UpgradeRarity;
  cost: number;             // base credit cost
  waveMin: number;          // minimum wave to appear
  // Stat modifications applied on purchase
  apply: (stats: LiveUpgradeStats) => LiveUpgradeStats;
}

/**
 * Mutable stat overrides that stack additively on top of base ship stats.
 * These persist for the entire endless run.
 */
export interface LiveUpgradeStats {
  maxHpBonus: number;
  shieldBonus: number;
  shieldRechargeBonus: number;
  armorRatingBonus: number;
  damageMultiplier: number;    // multiplicative
  fireRateMultiplier: number;  // multiplicative
  projectileSpeedBonus: number;
  thrustBonus: number;
  coolingBonus: number;
  powerOutputBonus: number;
  kineticBypassBonus: number;
  energyVulnerabilityReduction: number;
  pickupRangeBonus: number;
  buffDurationBonus: number;   // multiplicative
  dashCooldownReduction: number; // additive (0 to <1)
  droneCapacityBonus: number;
  heatCapacityBonus: number;
}

export function defaultLiveUpgradeStats(): LiveUpgradeStats {
  return {
    maxHpBonus: 0,
    shieldBonus: 0,
    shieldRechargeBonus: 0,
    armorRatingBonus: 0,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    projectileSpeedBonus: 0,
    thrustBonus: 0,
    coolingBonus: 0,
    powerOutputBonus: 0,
    kineticBypassBonus: 0,
    energyVulnerabilityReduction: 0,
    pickupRangeBonus: 0,
    buffDurationBonus: 1,
    dashCooldownReduction: 0,
    droneCapacityBonus: 0,
    heatCapacityBonus: 0,
  };
}

export interface PurchasedUpgrade {
  def: UpgradeDef;
  wavePurchased: number;
}

// ── Upgrade Catalog ────────────────────────────────────────────

export const UPGRADE_CATALOG: UpgradeDef[] = [
  // ── Offensive ──
  {
    id: 'reinforced_cannon',
    displayName: 'Reinforced Cannon',
    description: '+15% weapon damage',
    icon: '💥',
    category: 'offensive',
    rarity: 'common',
    cost: 40,
    waveMin: 1,
    apply: (s) => ({ ...s, damageMultiplier: s.damageMultiplier * 1.15 }),
  },
  {
    id: 'rapid_cooling_coils',
    displayName: 'Rapid Cooling Coils',
    description: '+20% fire rate',
    icon: '⚡',
    category: 'offensive',
    rarity: 'common',
    cost: 45,
    waveMin: 1,
    apply: (s) => ({ ...s, fireRateMultiplier: s.fireRateMultiplier * 1.20 }),
  },
  {
    id: 'magnetic_accelerator',
    displayName: 'Magnetic Accelerator',
    description: '+30% projectile speed',
    icon: '🚀',
    category: 'offensive',
    rarity: 'uncommon',
    cost: 65,
    waveMin: 3,
    apply: (s) => ({ ...s, projectileSpeedBonus: s.projectileSpeedBonus + 3 }),
  },
  {
    id: 'overcharge_capacitor',
    displayName: 'Overcharge Capacitor',
    description: '+25% weapon damage, +10% heat',
    icon: '🔋',
    category: 'offensive',
    rarity: 'uncommon',
    cost: 80,
    waveMin: 5,
    apply: (s) => ({ ...s, damageMultiplier: s.damageMultiplier * 1.25, heatCapacityBonus: s.heatCapacityBonus + 10 }),
  },
  {
    id: 'piercing_calculations',
    displayName: 'Piercing Calculations',
    description: '+8% kinetic bypass',
    icon: '🎯',
    category: 'offensive',
    rarity: 'rare',
    cost: 120,
    waveMin: 8,
    apply: (s) => ({ ...s, kineticBypassBonus: s.kineticBypassBonus + 0.08 }),
  },

  // ── Defensive ──
  {
    id: 'hull_reinforcement',
    displayName: 'Hull Reinforcement',
    description: '+40 max hull points',
    icon: '🛡',
    category: 'defensive',
    rarity: 'common',
    cost: 35,
    waveMin: 1,
    apply: (s) => ({ ...s, maxHpBonus: s.maxHpBonus + 40 }),
  },
  {
    id: 'shield_amplifier',
    displayName: 'Shield Amplifier',
    description: '+25 shield strength',
    icon: '🔵',
    category: 'defensive',
    rarity: 'common',
    cost: 40,
    waveMin: 1,
    apply: (s) => ({ ...s, shieldBonus: s.shieldBonus + 25 }),
  },
  {
    id: 'regenerative_matrix',
    displayName: 'Regenerative Matrix',
    description: '+30% shield recharge rate',
    icon: '💚',
    category: 'defensive',
    rarity: 'uncommon',
    cost: 60,
    waveMin: 3,
    apply: (s) => ({ ...s, shieldRechargeBonus: s.shieldRechargeBonus + 0.30 }),
  },
  {
    id: 'nano_armor',
    displayName: 'Nano-Armor Plating',
    description: '+12 armor rating, -5% energy vulnerability',
    icon: '🔩',
    category: 'defensive',
    rarity: 'uncommon',
    cost: 70,
    waveMin: 4,
    apply: (s) => ({ ...s, armorRatingBonus: s.armorRatingBonus + 12, energyVulnerabilityReduction: s.energyVulnerabilityReduction + 0.05 }),
  },
  {
    id: 'fortress_core',
    displayName: 'Fortress Core',
    description: '+80 max hull, +15 armor',
    icon: '🏰',
    category: 'defensive',
    rarity: 'rare',
    cost: 130,
    waveMin: 9,
    apply: (s) => ({ ...s, maxHpBonus: s.maxHpBonus + 80, armorRatingBonus: s.armorRatingBonus + 15 }),
  },

  // ── Utility ──
  {
    id: 'thruster_boost',
    displayName: 'Thruster Boost',
    description: '+15% thrust',
    icon: '🔥',
    category: 'utility',
    rarity: 'common',
    cost: 30,
    waveMin: 1,
    apply: (s) => ({ ...s, thrustBonus: s.thrustBonus + 0.15 }),
  },
  {
    id: 'improved_cooling',
    displayName: 'Improved Cooling',
    description: '+25% heat dissipation',
    icon: '❄',
    category: 'utility',
    rarity: 'common',
    cost: 35,
    waveMin: 1,
    apply: (s) => ({ ...s, coolingBonus: s.coolingBonus + 0.25 }),
  },
  {
    id: 'power_optimizer',
    displayName: 'Power Optimizer',
    description: '+15% power output',
    icon: '💡',
    category: 'utility',
    rarity: 'uncommon',
    cost: 55,
    waveMin: 3,
    apply: (s) => ({ ...s, powerOutputBonus: s.powerOutputBonus + 0.15 }),
  },
  {
    id: 'thermal_sink',
    displayName: 'Thermal Sink',
    description: '+20 heat capacity',
    icon: '♨',
    category: 'utility',
    rarity: 'uncommon',
    cost: 50,
    waveMin: 4,
    apply: (s) => ({ ...s, heatCapacityBonus: s.heatCapacityBonus + 20 }),
  },

  // ── Special ──
  {
    id: 'salvage_magnet',
    displayName: 'Salvage Magnet',
    description: '+40% pickup attraction range',
    icon: '🧲',
    category: 'special',
    rarity: 'common',
    cost: 30,
    waveMin: 1,
    apply: (s) => ({ ...s, pickupRangeBonus: s.pickupRangeBonus + 0.40 }),
  },
  {
    id: 'extended_buffs',
    displayName: 'Extended Buffs',
    description: '+30% buff duration',
    icon: '⏳',
    category: 'special',
    rarity: 'uncommon',
    cost: 50,
    waveMin: 3,
    apply: (s) => ({ ...s, buffDurationBonus: s.buffDurationBonus * 1.30 }),
  },
  {
    id: 'drone_expansion',
    displayName: 'Drone Expansion',
    description: '+1 drone capacity',
    icon: '🤖',
    category: 'special',
    rarity: 'rare',
    cost: 100,
    waveMin: 6,
    apply: (s) => ({ ...s, droneCapacityBonus: s.droneCapacityBonus + 1 }),
  },
  {
    id: 'adaptive_systems',
    displayName: 'Adaptive Systems',
    description: '+10% damage, +10% fire rate, +10% shield recharge',
    icon: '🌟',
    category: 'special',
    rarity: 'rare',
    cost: 140,
    waveMin: 12,
    apply: (s) => ({
      ...s,
      damageMultiplier: s.damageMultiplier * 1.10,
      fireRateMultiplier: s.fireRateMultiplier * 1.10,
      shieldRechargeBonus: s.shieldRechargeBonus + 0.10,
    }),
  },
];

// ── Shop Logic ─────────────────────────────────────────────────

const SHOP_OPTIONS = 3;

/**
 * Generate a set of upgrade options for the given wave number.
 * Returns 3 unique upgrades that the player hasn't already purchased,
 * filtered by wave availability. Higher waves unlock rarer upgrades.
 */
export function generateUpgradeOptions(
  waveNumber: number,
  purchased: PurchasedUpgrade[],
): UpgradeDef[] {
  const purchasedIds = new Set(purchased.map((p) => p.def.id));
  const available = UPGRADE_CATALOG.filter(
    (u) => u.waveMin <= waveNumber && !purchasedIds.has(u.id),
  );

  if (available.length === 0) return [];

  // Weight by rarity: common more likely at low waves, rare more likely at high waves
  const weighted = available.map((u) => {
    let weight = 1;
    if (u.rarity === 'rare') weight = 0.3 + waveNumber * 0.05;
    if (u.rarity === 'uncommon') weight = 0.6 + waveNumber * 0.02;
    if (u.rarity === 'common') weight = 2.0 - waveNumber * 0.03;
    return { upgrade: u, weight: Math.max(0.1, weight) };
  });

  // Weighted random sample of SHOP_OPTIONS
  const selected: UpgradeDef[] = [];
  const remaining = [...weighted];

  for (let i = 0; i < SHOP_OPTIONS && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = 0;
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight;
      if (roll <= 0) { chosen = j; break; }
    }
    selected.push(remaining[chosen].upgrade);
    remaining.splice(chosen, 1);
  }

  return selected;
}

/**
 * Compute the scaled cost of an upgrade based on wave number.
 * Cost increases 5% per wave above the upgrade's minimum wave.
 */
export function upgradeCost(upgrade: UpgradeDef, waveNumber: number): number {
  const waveScaling = 1 + Math.max(0, waveNumber - upgrade.waveMin) * 0.05;
  return Math.round(upgrade.cost * waveScaling);
}

/**
 * Apply an upgrade to the live stats, returning the new stats.
 */
export function applyUpgrade(stats: LiveUpgradeStats, upgrade: UpgradeDef): LiveUpgradeStats {
  return upgrade.apply({ ...stats });
}

/**
 * Apply all purchased upgrades in order to fresh default stats.
 */
export function applyAllUpgrades(purchased: PurchasedUpgrade[]): LiveUpgradeStats {
  let stats = defaultLiveUpgradeStats();
  for (const p of purchased) {
    stats = p.def.apply(stats);
  }
  return stats;
}

/**
 * Full hull repair offered every 5 waves as a free "rest stop" option.
 */
export function computeRestRepairAmount(maxHp: number, waveNumber: number): number {
  return Math.round(maxHp * (0.25 + Math.min(waveNumber * 0.01, 0.15)));
}

export function getRarityColor(rarity: UpgradeRarity): string {
  switch (rarity) {
    case 'common': return '#94a3b8';
    case 'uncommon': return '#4ade80';
    case 'rare': return '#c084fc';
  }
}

export function getRarityLabel(rarity: UpgradeRarity): string {
  switch (rarity) {
    case 'common': return 'Common';
    case 'uncommon': return 'Uncommon';
    case 'rare': return 'Rare';
  }
}
