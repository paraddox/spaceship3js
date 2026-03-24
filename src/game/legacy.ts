// ── Legacy Codex — Persistent Cross-Run Progression ─────────────
//
// Every endless run earns Legacy XP based on performance.
// Milestones unlock permanent Starting Bonuses — passive buffs
// that apply at the start of every future run.
//
// This gives every run permanent value, even early deaths.
// Different milestones reward different playstyles, creating
// natural build diversity pressure.
//
// Persistence: localStorage via App.ts
// Scope: endless mode only (encounter modes use the existing
//        credit + module unlock progression system)

// ── Types ─────────────────────────────────────────────────────

export type StartingBonusId =
  | 'tough_hull'
  | 'quick_start'
  | 'credit_booster'
  | 'lucky_draw'
  | 'shield_seed'
  | 'combo_starter'
  | 'heat_sink'
  | 'dash_master';

export interface StartingBonusDef {
  id: StartingBonusId;
  displayName: string;
  icon: string;
  description: string;
  /** Effect applied at run start. */
    effect: {
    kind: 'bonus_hp' | 'bonus_credits' | 'bonus_shield' | 'ability_cd_reduction' | 'heat_capacity' | 'dash_cd_reduction' | 'combo_window' | 'credit_percent';
    value: number;
  };
  /** Whether this bonus must be reapplied after module rebuilds. */
  persistsRebuild?: boolean;
}

export interface MilestoneDef {
  id: string;
  displayName: string;
  icon: string;
  description: string;
  /** Check function: does this run's stats (and legacy) satisfy the milestone? */
  check: (stats: RunSnapshot, legacy: LegacyState) => boolean;
  /** Category for grouping. */
  category: 'combat' | 'survival' | 'economy' | 'mastery';
  /** The starting bonus unlocked by this milestone. */
  unlocks: StartingBonusId;
  /** Hint shown before completion. */
  hint: string;
}

export interface RunSnapshot {
  waveReached: number;
  totalKills: number;
  eliteKills: number;
  bossKills: number;
  score: number;
  creditsEarned: number;
  timeSeconds: number;
  bestCombo: number;
  highestComboTier: string;
  damageDealt: number;
  damageTaken: number;
  pickupsCollected: number;
  hpRemaining: number;
  maxHp: number;
  mutatorsChosen: string[];
  upgradesPurchased: string[];
  overdriveActivations: number;
  dashCount: number;
  abilityActivations: number;
  blueprintsSalvaged: number;
  nearMissTotal: number;
  nearMissBestStreak: number;
  grade: string;
}

export interface CompletedMilestone {
  milestoneId: string;
  completedAt: number; // timestamp
  runNumber: number;
}

export interface LegacyState {
  totalXp: number;
  totalRuns: number;
  bestWave: number;
  bestScore: number;
  bestGrade: string;
  totalKills: number;
  totalCreditsEarned: number;
  completedMilestones: CompletedMilestone[];
  unlockedBonuses: StartingBonusId[];
  /** Currently active bonuses (user-selected from unlocked). Max 3. */
  activeBonuses: StartingBonusId[];
  /** Total blueprints salvaged across all runs. */
  totalSalvaged: number;
}

export const MAX_ACTIVE_BONUSES = 3;
export const LEGACY_STORAGE_KEY = 'spachip3js.legacy';

// ── Starting Bonus Catalog ───────────────────────────────────

export const STARTING_BONUSES: StartingBonusDef[] = [
  {
    id: 'tough_hull',
    displayName: 'Tough Hull',
    icon: '🛡️',
    description: '+15% max HP at run start',
    effect: { kind: 'bonus_hp', value: 15 },
    persistsRebuild: true,
  },
  {
    id: 'quick_start',
    displayName: 'Quick Start',
    icon: '💰',
    description: 'Start with 40 bonus credits',
    effect: { kind: 'bonus_credits', value: 40 },
  },
  {
    id: 'credit_booster',
    displayName: 'Credit Hoarder',
    icon: '💎',
    description: '+10% credits earned per wave',
    effect: { kind: 'credit_percent', value: 10 },
  },
  {
    id: 'lucky_draw',
    displayName: 'Lucky Draw',
    icon: '🎰',
    description: 'All ability cooldowns -15%',
    effect: { kind: 'ability_cd_reduction', value: 15 },
  },
  {
    id: 'shield_seed',
    displayName: 'Shield Seed',
    icon: '🔵',
    description: 'Start with a small shield (15 HP)',
    effect: { kind: 'bonus_shield', value: 15 },
    persistsRebuild: true,
  },
  {
    id: 'combo_starter',
    displayName: 'Combo Starter',
    icon: '🔥',
    description: 'Combo window +0.8s',
    effect: { kind: 'combo_window', value: 0.8 },
  },
  {
    id: 'heat_sink',
    displayName: 'Heat Sink',
    icon: '❄️',
    description: '+20% heat capacity',
    effect: { kind: 'heat_capacity', value: 20 },
    persistsRebuild: true,
  },
  {
    id: 'dash_master',
    displayName: 'Dash Master',
    icon: '💨',
    description: '-20% dash cooldown',
    effect: { kind: 'dash_cd_reduction', value: 20 },
  },
];

const BONUS_BY_ID = Object.fromEntries(STARTING_BONUSES.map((b) => [b.id, b])) as Record<StartingBonusId, StartingBonusDef>;

export function getStartingBonusDef(id: StartingBonusId): StartingBonusDef | undefined {
  return BONUS_BY_ID[id];
}

// ── Milestone Catalog ────────────────────────────────────────
//
// Each milestone represents a significant achievement across runs.
// They're designed to reward different playstyles so players
// naturally explore different builds.

export const MILESTONES: MilestoneDef[] = [
  // ── Combat Milestones ──
  {
    id: 'first_blood',
    displayName: 'First Blood',
    icon: '⚔️',
    description: 'Get your first kill in endless mode',
    category: 'combat',
    unlocks: 'quick_start',
    hint: 'Kill 1 enemy in any endless run',
    check: (s) => s.totalKills >= 1,
  },
  {
    id: 'centurion',
    displayName: 'Centurion',
    icon: '💀',
    description: 'Accumulate 100 total kills across all runs',
    category: 'combat',
    unlocks: 'tough_hull',
    hint: '100 lifetime kills',
    check: (_s, legacy) => legacy.totalKills >= 100,
  },
  {
    id: 'elite_slayer',
    displayName: 'Elite Slayer',
    icon: '👑',
    description: 'Kill 3 elites in a single run',
    category: 'combat',
    unlocks: 'combo_starter',
    hint: 'Kill 3 elite enemies in one run',
    check: (s) => s.eliteKills >= 3,
  },
  {
    id: 'massacre',
    displayName: 'Massacre',
    icon: '☠️',
    description: 'Achieve a 10x kill combo',
    category: 'combat',
    unlocks: 'heat_sink',
    hint: 'Reach 10x combo',
    check: (s) => s.bestCombo >= 10,
  },
  {
    id: 'damage_dealer',
    displayName: 'Heavy Hitter',
    icon: '💥',
    description: 'Deal 5,000 total damage in a single run',
    category: 'combat',
    unlocks: 'dash_master',
    hint: 'Deal 5,000 damage in one run',
    check: (s) => s.damageDealt >= 5000,
  },

  // ── Survival Milestones ──
  {
    id: 'wave_5',
    displayName: 'Wave Runner',
    icon: '🌊',
    description: 'Reach wave 5 in endless mode',
    category: 'survival',
    unlocks: 'shield_seed',
    hint: 'Survive to wave 5',
    check: (s) => s.waveReached >= 5,
  },
  {
    id: 'wave_10',
    displayName: 'Veteran',
    icon: '⭐',
    description: 'Reach wave 10 in endless mode',
    category: 'survival',
    unlocks: 'credit_booster',
    hint: 'Survive to wave 10',
    check: (s) => s.waveReached >= 10,
  },
  {
    id: 'iron_wall',
    displayName: 'Iron Wall',
    icon: '🏰',
    description: 'Take less than 200 damage in a wave-5+ run',
    category: 'survival',
    unlocks: 'heat_sink',
    hint: 'Clear wave 5+ taking <200 damage',
    check: (s) => s.waveReached >= 5 && s.damageTaken < 200,
  },
  {
    id: 'full_hp_clear',
    displayName: 'Untouchable',
    icon: '✨',
    description: 'Clear wave 5+ with 80%+ HP remaining',
    category: 'survival',
    unlocks: 'lucky_draw',
    hint: 'Clear wave 5+ with 80%+ HP',
    check: (s) => s.waveReached >= 5 && s.maxHp > 0 && (s.hpRemaining / s.maxHp) >= 0.8,
  },

  // ── Economy Milestones ──
  {
    id: 'first_purchase',
    displayName: 'Armed and Ready',
    icon: '🛒',
    description: 'Purchase your first upgrade in endless mode',
    category: 'economy',
    unlocks: 'credit_booster',
    hint: 'Buy an upgrade in the shop',
    check: (s) => s.upgradesPurchased.length >= 1,
  },
  {
    id: 'wealthy',
    displayName: 'Wealthy',
    icon: '💰',
    description: 'Earn 500+ credits in a single run',
    category: 'economy',
    unlocks: 'quick_start',
    hint: 'Earn 500 credits in one run',
    check: (s) => s.creditsEarned >= 500,
  },
  {
    id: 'big_spender',
    displayName: 'Big Spender',
    icon: '🏷️',
    description: 'Purchase 5 upgrades in a single run',
    category: 'economy',
    unlocks: 'lucky_draw',
    hint: 'Buy 5 upgrades in one run',
    check: (s) => s.upgradesPurchased.length >= 5,
  },

  // ── Mastery Milestones ──
  {
    id: 'five_runs',
    displayName: 'Dedicated',
    icon: '🔄',
    description: 'Complete 5 endless runs',
    category: 'mastery',
    unlocks: 'quick_start',
    hint: 'Play 5 endless runs',
    check: (_s, legacy) => legacy.totalRuns >= 5,
  },
  {
    id: 'grade_a',
    displayName: 'Ace Pilot',
    icon: '🏆',
    description: 'Earn an A grade on any run',
    category: 'mastery',
    unlocks: 'tough_hull',
    hint: 'Earn an A grade',
    check: (s) => s.grade === 'A',
  },
  {
    id: 'grade_s',
    displayName: 'Legendary',
    icon: '🌟',
    description: 'Earn an S grade on any run',
    category: 'mastery',
    unlocks: 'shield_seed',
    hint: 'Earn an S grade',
    check: (s) => s.grade === 'S',
  },
  {
    id: 'mutated',
    displayName: 'Mutated',
    icon: '🧬',
    description: 'Complete a run with 2+ mutators active',
    category: 'mastery',
    unlocks: 'combo_starter',
    hint: 'Finish a run with 2+ traits',
    check: (s) => s.mutatorsChosen.length >= 2,
  },

  // ── Salvage Milestones ──
  {
    id: 'first_salvage',
    displayName: 'Scavenger',
    icon: '🔧',
    description: 'Salvage your first enemy blueprint',
    category: 'mastery',
    unlocks: 'quick_start',
    hint: 'Kill an elite enemy and salvage its blueprint',
    check: (s) => s.blueprintsSalvaged >= 1,
  },
  {
    id: 'salvage_boss',
    displayName: 'Trophy Hunter',
    icon: '🏆',
    description: 'Salvage a boss blueprint',
    category: 'combat',
    unlocks: 'tough_hull',
    hint: 'Defeat a boss and salvage its design',
    check: (s) => s.blueprintsSalvaged >= 1 && s.bossKills >= 1,
  },
  {
    id: 'salvage_5',
    displayName: 'Collector',
    icon: '📦',
    description: 'Salvage 5 blueprints across all runs',
    category: 'mastery',
    unlocks: 'shield_seed',
    hint: 'Salvage 5 unique enemy blueprints',
    check: (_s, legacy) => legacy.totalSalvaged >= 5,
  },

  // ── Style Milestones ──
  {
    id: 'bullet_dancer',
    displayName: 'Bullet Dancer',
    icon: '💫',
    description: 'Dodge 50 projectiles in a single run',
    category: 'combat',
    unlocks: 'lucky_draw',
    hint: 'Trigger 50 near-misses in one run',
    check: (s) => s.nearMissTotal >= 50,
  },
  {
    id: 'ghost',
    displayName: 'Ghost',
    icon: '👻',
    description: 'Achieve a near-miss streak of 5+',
    category: 'survival',
    unlocks: 'dash_master',
    hint: 'Chain 5 near-misses within 2 seconds',
    check: (s) => s.nearMissBestStreak >= 5,
  },
];

// ── Default State ────────────────────────────────────────────

export const DEFAULT_LEGACY_STATE: LegacyState = {
  totalXp: 0,
  totalRuns: 0,
  bestWave: 0,
  bestScore: 0,
  bestGrade: '',
  totalKills: 0,
  totalCreditsEarned: 0,
  completedMilestones: [],
  unlockedBonuses: [],
  activeBonuses: [],
  totalSalvaged: 0,
};

// ── Legacy XP Calculation ────────────────────────────────────
//
// XP is earned based on run performance. Every run gives some XP,
// so even early deaths contribute to progression.

export function computeLegacyXp(snapshot: RunSnapshot): number {
  let xp = 0;

  // Base XP for playing
  xp += 5;

  // Wave XP: 3 XP per wave reached
  xp += snapshot.waveReached * 3;

  // Kill XP: 0.5 XP per kill
  xp += Math.floor(snapshot.totalKills * 0.5);

  // Score XP: 1 XP per 200 score
  xp += Math.floor(snapshot.score / 200);

  // Combo XP: bonus for high combos
  if (snapshot.bestCombo >= 5) xp += 5;
  if (snapshot.bestCombo >= 10) xp += 10;
  if (snapshot.bestCombo >= 20) xp += 15;

  // Near-miss XP: reward skilled dodging
  xp += Math.min(Math.floor(snapshot.nearMissTotal * 1.5), 30);

  // Near-miss streak XP
  if (snapshot.nearMissBestStreak >= 3) xp += 5;
  if (snapshot.nearMissBestStreak >= 5) xp += 10;

  // Grade bonus
  switch (snapshot.grade) {
    case 'S': xp += 30; break;
    case 'A': xp += 20; break;
    case 'B': xp += 10; break;
    case 'C': xp += 5; break;
  }

  // Survival bonus
  if (snapshot.timeSeconds >= 120) xp += 5;
  if (snapshot.timeSeconds >= 300) xp += 10;
  if (snapshot.timeSeconds >= 600) xp += 15;

  return xp;
}

// ── Legacy Level ─────────────────────────────────────────────
//
// Levels are derived from total XP. Each level unlocks a milestone
// slot (not directly — milestones are unlocked by achievements).
// Levels are just a vanity/ranking indicator.

export function computeLegacyLevel(totalXp: number): { level: number; currentXp: number; xpForNext: number } {
  // XP curve: level N requires N*25 XP
  // Level 1: 25 XP, Level 2: 75 XP, Level 3: 150 XP, etc.
  let level = 0;
  let xpAccumulated = 0;
  while (true) {
    const nextLevelXp = (level + 1) * 25;
    if (xpAccumulated + nextLevelXp > totalXp) break;
    xpAccumulated += nextLevelXp;
    level++;
  }
  const currentXp = totalXp - xpAccumulated;
  const xpForNext = (level + 1) * 25;
  return { level, currentXp, xpForNext };
}

export function getLegacyRank(level: number): { name: string; icon: string } {
  if (level >= 20) return { name: 'Admiral', icon: '🎖️' };
  if (level >= 15) return { name: 'Captain', icon: '⚓' };
  if (level >= 10) return { name: 'Commander', icon: '🛡️' };
  if (level >= 7) return { name: 'Lieutenant', icon: '🗡️' };
  if (level >= 5) return { name: 'Warrant Officer', icon: '🎖️' };
  if (level >= 3) return { name: 'Pilot', icon: '✈️' };
  if (level >= 1) return { name: 'Cadet', icon: '📘' };
  return { name: 'Recruit', icon: '🔰' };
}

// ── Run Finalization ─────────────────────────────────────────
//
// Call this when an endless run ends. Updates all legacy stats,
// checks milestones, and returns newly completed milestones.

export function finalizeRun(
  legacy: LegacyState,
  snapshot: RunSnapshot,
): { updated: LegacyState; newMilestones: MilestoneDef[] } {
  const updated = { ...legacy };

  // Update aggregate stats
  const xpGained = computeLegacyXp(snapshot);
  updated.totalXp += xpGained;
  updated.totalRuns += 1;
  updated.bestWave = Math.max(updated.bestWave, snapshot.waveReached);
  updated.bestScore = Math.max(updated.bestScore, snapshot.score);
  updated.totalKills += snapshot.totalKills;
  updated.totalCreditsEarned += snapshot.creditsEarned;
  updated.totalSalvaged += snapshot.blueprintsSalvaged;

  // Track best grade (S > A > B > C > D)
  const gradeOrder = ['D', 'C', 'B', 'A', 'S'];
  const currentIdx = gradeOrder.indexOf(updated.bestGrade);
  const newIdx = gradeOrder.indexOf(snapshot.grade);
  if (newIdx > currentIdx) {
    updated.bestGrade = snapshot.grade;
  }

  // Check milestones
  const newMilestones: MilestoneDef[] = [];
  const alreadyCompleted = new Set(updated.completedMilestones.map((m) => m.milestoneId));

  for (const milestone of MILESTONES) {
    if (alreadyCompleted.has(milestone.id)) continue;
    // Milestones with legacy checks need the updated state
    if (milestone.check(snapshot, updated)) {
      updated.completedMilestones = [
        ...updated.completedMilestones,
        { milestoneId: milestone.id, completedAt: Date.now(), runNumber: updated.totalRuns },
      ];
      // Unlock the associated bonus
      if (!updated.unlockedBonuses.includes(milestone.unlocks)) {
        updated.unlockedBonuses = [...updated.unlockedBonuses, milestone.unlocks];
      }
      newMilestones.push(milestone);
    }
  }

  // If active bonuses are empty and we have unlocked ones, auto-activate first
  if (updated.activeBonuses.length === 0 && updated.unlockedBonuses.length > 0) {
    updated.activeBonuses = [updated.unlockedBonuses[0]];
  }

  return { updated, newMilestones };
}

// ── Bonus Management ─────────────────────────────────────────

export function canActivateBonus(legacy: LegacyState, bonusId: StartingBonusId): boolean {
  if (!legacy.unlockedBonuses.includes(bonusId)) return false;
  if (legacy.activeBonuses.includes(bonusId)) return false;
  return legacy.activeBonuses.length < MAX_ACTIVE_BONUSES;
}

export function toggleActiveBonus(legacy: LegacyState, bonusId: StartingBonusId): LegacyState {
  const idx = legacy.activeBonuses.indexOf(bonusId);
  if (idx >= 0) {
    // Deactivate
    return { ...legacy, activeBonuses: legacy.activeBonuses.filter((_, i) => i !== idx) };
  }
  if (canActivateBonus(legacy, bonusId)) {
    return { ...legacy, activeBonuses: [...legacy.activeBonuses, bonusId] };
  }
  return legacy;
}

export function getActiveBonusEffects(legacy: LegacyState): StartingBonusDef['effect'][] {
  return legacy.activeBonuses
    .map((id) => BONUS_BY_ID[id])
    .filter(Boolean)
    .map((b) => b.effect);
}

/** Effects that modify stat baselines and must be reapplied after module rebuilds. */
export function getRebuildPersistentEffects(legacy: LegacyState): StartingBonusDef[] {
  return legacy.activeBonuses
    .map((id) => BONUS_BY_ID[id])
    .filter((b) => b?.persistsRebuild);
}

/** Returns the credit percentage boost from active bonuses (e.g. 10 for +10%). */
export function getCreditPercentBoost(legacy: LegacyState): number {
  return getActiveBonusEffects(legacy)
    .filter((e) => e.kind === 'credit_percent')
    .reduce((sum, e) => sum + e.value, 0);
}

// ── Query Helpers ────────────────────────────────────────────

export function isMilestoneCompleted(legacy: LegacyState, milestoneId: string): boolean {
  return legacy.completedMilestones.some((m) => m.milestoneId === milestoneId);
}

export function getMilestoneProgress(
  legacy: LegacyState,
): { total: number; completed: number; byCategory: Record<string, { total: number; completed: number }> } {
  const categories = Array.from(new Set(MILESTONES.map((m) => m.category)));
  const byCategory: Record<string, { total: number; completed: number }> = {};
  for (const cat of categories) {
    const catMilestones = MILESTONES.filter((m) => m.category === cat);
    byCategory[cat] = {
      total: catMilestones.length,
      completed: catMilestones.filter((m) => isMilestoneCompleted(legacy, m.id)).length,
    };
  }
  const completed = legacy.completedMilestones.length;
  return { total: MILESTONES.length, completed, byCategory };
}

export function getLegacySummary(legacy: LegacyState): {
  level: number;
  rank: { name: string; icon: string };
  currentXp: number;
  xpForNext: number;
  totalRuns: number;
  bestWave: number;
  bestScore: number;
  bestGrade: string;
  totalKills: number;
  milestonesCompleted: number;
  milestonesTotal: number;
  bonusesUnlocked: number;
  bonusesActive: number;
} {
  const { level, currentXp, xpForNext } = computeLegacyLevel(legacy.totalXp);
  const rank = getLegacyRank(level);
  const milestoneProgress = getMilestoneProgress(legacy);
  return {
    level,
    rank,
    currentXp,
    xpForNext,
    totalRuns: legacy.totalRuns,
    bestWave: legacy.bestWave,
    bestScore: legacy.bestScore,
    bestGrade: legacy.bestGrade,
    totalKills: legacy.totalKills,
    milestonesCompleted: milestoneProgress.completed,
    milestonesTotal: milestoneProgress.total,
    bonusesUnlocked: legacy.unlockedBonuses.length,
    bonusesActive: legacy.activeBonuses.length,
  };
}

// ── Persistence ──────────────────────────────────────────────

export function loadLegacyState(): LegacyState {
  try {
    const saved = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_LEGACY_STATE };
    const data = JSON.parse(saved) as Partial<LegacyState>;
    return {
      totalXp: Number(data.totalXp ?? 0),
      totalRuns: Number(data.totalRuns ?? 0),
      bestWave: Number(data.bestWave ?? 0),
      bestScore: Number(data.bestScore ?? 0),
      bestGrade: String(data.bestGrade ?? ''),
      totalKills: Number(data.totalKills ?? 0),
      totalCreditsEarned: Number(data.totalCreditsEarned ?? 0),
      completedMilestones: Array.isArray(data.completedMilestones) ? data.completedMilestones : [],
      unlockedBonuses: Array.isArray(data.unlockedBonuses) ? data.unlockedBonuses : [],
      activeBonuses: Array.isArray(data.activeBonuses) ? data.activeBonuses : [],
      totalSalvaged: Number(data.totalSalvaged ?? 0),
    };
  } catch {
    return { ...DEFAULT_LEGACY_STATE };
  }
}

export function persistLegacyState(legacy: LegacyState): void {
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));
}
