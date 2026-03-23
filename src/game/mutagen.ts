// ── Mutagen System ────────────────────────────────────────────
//
// Absorb enemy affixes as permanent ship mutations.
//
// When elite enemies die, they drop "essence" from their affixes.
// Between waves, the upgrade shop offers a mutation extraction panel
// where you can absorb one essence, permanently adding a passive ability
// to your ship that reflects that affix's nature.
//
// Mutations persist across runs in localStorage. Max 6 active mutations.
// Each mutation can be absorbed multiple times for stacking power.
//
// Design principle: the existing 10 affix definitions ARE the content
// pipeline — no new enemy types needed, just new player effects from
// existing data.

// ── Types ─────────────────────────────────────────────────────

export type MutagenId =
  | 'tough'
  | 'aggressive'
  | 'swift'
  | 'shielded'
  | 'veteran'
  | 'regenerating'
  | 'explosive'
  | 'gunner'
  | 'juggernaut'
  | 'overcharged';

/** A single absorbed essence waiting to be extracted in the shop. */
export interface Essence {
  /** Source affix ID. */
  affixId: MutagenId;
  /** Wave number the elite died on. */
  waveNumber: number;
}

/** A permanently absorbed mutation with stack count. */
export interface Mutation {
  id: MutagenId;
  /** How many times this mutation has been absorbed. */
  stacks: number;
}

/** Mutation definition — maps affix → player passive effect. */
export interface MutationDef {
  id: MutagenId;
  displayName: string;
  icon: string;
  color: string;
  description: string;
  /** Description of what each additional stack adds. */
  stackDescription: string;
  flavor: string;
}

/** Persistent state across runs. */
export interface MutagenState {
  /** Absorbed mutations with stack counts. Max 6 unique mutations. */
  mutations: Mutation[];
  /** Essence gathered this run (consumed in shop). */
  pendingEssence: Essence[];
  /** Lifetime stats. */
  totalAbsorbed: number;
  totalEssenceCollected: number;
}

// ── Constants ─────────────────────────────────────────────────

export const MAX_UNIQUE_MUTATIONS = 6;
export const MAX_ESSENCE_SLOTS = 3;
export const STORAGE_KEY = 'spachip3js.mutagen';

// ── Mutation Catalog ──────────────────────────────────────────
// One mutation per affix. Each is the "inversion" of the enemy
// ability — the enemy's power becomes YOUR passive.

export const MUTATION_CATALOG: MutationDef[] = [
  {
    id: 'tough',
    displayName: 'Resilience',
    icon: '🛡️',
    color: '#38bdf8',
    description: '+8% max HP per stack',
    stackDescription: '+8% max HP',
    flavor: 'What doesn\'t kill you makes you tankier.',
  },
  {
    id: 'aggressive',
    displayName: 'Ferocity',
    icon: '🔥',
    color: '#f97316',
    description: '+6% damage per stack',
    stackDescription: '+6% damage',
    flavor: 'Their aggression feeds your fury.',
  },
  {
    id: 'swift',
    displayName: 'Afterburner Graft',
    icon: '💨',
    color: '#a78bfa',
    description: '+5% thrust per stack',
    stackDescription: '+5% thrust',
    flavor: 'Stolen velocity, surgically grafted.',
  },
  {
    id: 'shielded',
    displayName: 'Barrier Symbiote',
    icon: '🔰',
    color: '#22d3ee',
    description: '+12% shield strength per stack',
    stackDescription: '+12% shield',
    flavor: 'Their shield matrix learned to love you.',
  },
  {
    id: 'veteran',
    displayName: 'Combat Mastery',
    icon: '⭐',
    color: '#fbbf24',
    description: '+5% damage AND +4% HP per stack',
    stackDescription: '+5% dmg, +4% HP',
    flavor: 'Experience absorbed from a hundred battles.',
  },
  {
    id: 'regenerating',
    displayName: 'Nanofiber Weave',
    icon: '💚',
    color: '#4ade80',
    description: 'Regenerate 1% max HP/sec per stack',
    stackDescription: '+1% HP/sec',
    flavor: 'Their regeneration matrix, now yours.',
  },
  {
    id: 'explosive',
    displayName: 'Detonation Core',
    icon: '💥',
    color: '#ef4444',
    description: 'On death: explode for 15×stack damage in 5u radius',
    stackDescription: '+15 damage on death',
    flavor: 'Go out with a bang. A really big bang.',
  },
  {
    id: 'gunner',
    displayName: 'Targeting Implant',
    icon: '🎯',
    color: '#fb923c',
    description: '+5% fire rate per stack',
    stackDescription: '+5% fire rate',
    flavor: 'Their targeting firmware, reverse-engineered.',
  },
  {
    id: 'juggernaut',
    displayName: 'Siege Plating',
    icon: '💀',
    color: '#dc2626',
    description: '+6 armor per stack, −2% thrust per stack',
    stackDescription: '+6 armor, −2% thrust',
    flavor: 'Heavy armor. You\'ll feel it.',
  },
  {
    id: 'overcharged',
    displayName: 'Overcharge Conduit',
    icon: '⚡',
    color: '#facc15',
    description: '+4% damage and +3% fire rate per stack',
    stackDescription: '+4% dmg, +3% fire rate',
    flavor: 'Dangerous power. Worth the risk.',
  },
];

// ── Lookup ────────────────────────────────────────────────────

const MUTATION_MAP = new Map(MUTATION_CATALOG.map(m => [m.id, m]));

export function getMutationDef(id: MutagenId): MutationDef | undefined {
  return MUTATION_MAP.get(id);
}

// ── State Management ──────────────────────────────────────────

export function createMutagenState(): MutagenState {
  return {
    mutations: [],
    pendingEssence: [],
    totalAbsorbed: 0,
    totalEssenceCollected: 0,
  };
}

// ── Persistence ───────────────────────────────────────────────

export function loadMutagenState(): MutagenState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return createMutagenState();
    const data = JSON.parse(saved) as Partial<MutagenState>;
    return {
      mutations: Array.isArray(data.mutations) ? data.mutations : [],
      pendingEssence: Array.isArray(data.pendingEssence) ? data.pendingEssence : [],
      totalAbsorbed: Number(data.totalAbsorbed ?? 0),
      totalEssenceCollected: Number(data.totalEssenceCollected ?? 0),
    };
  } catch {
    return createMutagenState();
  }
}

export function persistMutagenState(state: MutagenState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Essence Collection ────────────────────────────────────────

/**
 * Add essence drops from an elite kill.
 * Elite enemies (2+ affixes) drop 1 essence from a random affix.
 * Bosses drop 1 essence from each affix.
 */
export function collectEssenceFromKill(
  state: MutagenState,
  affixIds: MutagenId[],
  isBoss: boolean,
  waveNumber: number,
): MutagenState {
  if (affixIds.length === 0) return state;

  const newEssence: Essence[] = [];
  // Pick 1 random essence for elites, all for bosses
  if (isBoss) {
    for (const id of affixIds) {
      if (state.pendingEssence.length + newEssence.length < MAX_ESSENCE_SLOTS) {
        newEssence.push({ affixId: id, waveNumber });
      }
    }
  } else {
    // Random pick from affixes
    const pick = affixIds[Math.floor(Math.random() * affixIds.length)];
    if (state.pendingEssence.length < MAX_ESSENCE_SLOTS) {
      newEssence.push({ affixId: pick, waveNumber });
    }
  }

  if (newEssence.length === 0) return state;

  return {
    ...state,
    pendingEssence: [...state.pendingEssence, ...newEssence],
    totalEssenceCollected: state.totalEssenceCollected + newEssence.length,
  };
}

// ── Absorption ────────────────────────────────────────────────

/**
 * Absorb a pending essence into a permanent mutation.
 * If the mutation already exists, stacks increase.
 * If new and at max unique mutations, fails.
 */
export function absorbEssence(
  state: MutagenState,
  essenceIndex: number,
): MutagenState {
  if (essenceIndex < 0 || essenceIndex >= state.pendingEssence.length) return state;

  const essence = state.pendingEssence[essenceIndex];
  const existing = state.mutations.find(m => m.id === essence.affixId);

  let newMutations: Mutation[];
  if (existing) {
    // Stack onto existing
    newMutations = state.mutations.map(m =>
      m.id === essence.affixId ? { ...m, stacks: m.stacks + 1 } : m,
    );
  } else if (state.mutations.length < MAX_UNIQUE_MUTATIONS) {
    // New mutation
    newMutations = [...state.mutations, { id: essence.affixId, stacks: 1 }];
  } else {
    // At max unique mutations
    return state;
  }

  const newPending = state.pendingEssence.filter((_, i) => i !== essenceIndex);

  return {
    mutations: newMutations,
    pendingEssence: newPending,
    totalAbsorbed: state.totalAbsorbed + 1,
    totalEssenceCollected: state.totalEssenceCollected,
  };
}

// ── Stat Computation ──────────────────────────────────────────
// Pure functions that compute the stat modifications from active
// mutations. Called at run start and when mutations change.

export interface MutagenStatMods {
  maxHpMultiplier: number;
  damageMultiplier: number;
  fireRateMultiplier: number;
  thrustMultiplier: number;
  shieldMultiplier: number;
  armorBonus: number;
  hpRegenPerSecond: number;   // fraction of max HP per second
  deathExplosionDamage: number; // flat damage on death, 0 = no explosion
}

/**
 * Compute stat modifications from all active mutations.
 */
export function computeMutagenStats(mutations: Mutation[]): MutagenStatMods {
  const mods: MutagenStatMods = {
    maxHpMultiplier: 1,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    thrustMultiplier: 1,
    shieldMultiplier: 1,
    armorBonus: 0,
    hpRegenPerSecond: 0,
    deathExplosionDamage: 0,
  };

  for (const mut of mutations) {
    const def = MUTATION_MAP.get(mut.id);
    if (!def) continue;
    const s = mut.stacks;

    switch (mut.id) {
      case 'tough':
        mods.maxHpMultiplier *= (1 + 0.08 * s);
        break;
      case 'aggressive':
        mods.damageMultiplier *= (1 + 0.06 * s);
        break;
      case 'swift':
        mods.thrustMultiplier *= (1 + 0.05 * s);
        break;
      case 'shielded':
        mods.shieldMultiplier *= (1 + 0.12 * s);
        break;
      case 'veteran':
        mods.damageMultiplier *= (1 + 0.05 * s);
        mods.maxHpMultiplier *= (1 + 0.04 * s);
        break;
      case 'regenerating':
        mods.hpRegenPerSecond += 0.01 * s;
        break;
      case 'explosive':
        mods.deathExplosionDamage += 15 * s;
        break;
      case 'gunner':
        mods.fireRateMultiplier *= (1 + 0.05 * s);
        break;
      case 'juggernaut':
        mods.armorBonus += 6 * s;
        mods.thrustMultiplier *= (1 - 0.02 * s);
        break;
      case 'overcharged':
        mods.damageMultiplier *= (1 + 0.04 * s);
        mods.fireRateMultiplier *= (1 + 0.03 * s);
        break;
    }
  }

  return mods;
}

// ── Query Helpers ─────────────────────────────────────────────

/** Get mutation stacks for a specific mutation, or 0 if not active. */
export function getMutationStacks(mutations: Mutation[], id: MutagenId): number {
  return mutations.find(m => m.id === id)?.stacks ?? 0;
}

/** Check if any mutation is active at all. */
export function hasMutations(state: MutagenState): boolean {
  return state.mutations.length > 0;
}

/** Check if death explosion is active. */
export function hasDeathExplosion(mutations: Mutation[]): boolean {
  return getMutationStacks(mutations, 'explosive') > 0;
}

/** Get death explosion damage. */
export function getDeathExplosionDamage(mutations: Mutation[]): number {
  return getMutationStacks(mutations, 'explosive') * 15;
}

/** Get HP regen rate (fraction of max HP per second). */
export function getHpRegenRate(mutations: Mutation[]): number {
  return getMutationStacks(mutations, 'regenerating') * 0.01;
}

/** Check if player can absorb more unique mutations. */
export function canAbsorbNew(state: MutagenState): boolean {
  return state.mutations.length < MAX_UNIQUE_MUTATIONS;
}
