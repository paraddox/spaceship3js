// ── Pilot Chronicle — Persistent Run History & Titles ───────────
//
// Every endless run is saved as a permanent entry in the pilot's
// combat chronicle. This gives meaning to the grade system, creates
// a personal narrative across runs, and unlocks cosmetic pilot titles
// that reflect playstyle mastery.
//
// Persistence: localStorage via CHRONICLE_STORAGE_KEY

import { type RunStats, type RunGrade, computeRunGrade, getCauseOfDeath } from './run-report';

// ── Types ─────────────────────────────────────────────────────

export interface RunRecord {
  /** Unique run ID (timestamp-based). */
  id: string;
  /** ISO timestamp of run completion. */
  completedAt: string;
  /** Full run stats snapshot. */
  stats: RunStats;
  /** Computed grade. */
  grade: RunGrade;
  /** Cause of death string. */
  causeOfDeath: string;
  /** Sigil used (id + tier). */
  sigil: { id: string; tier: number } | null;
  /** Mutator traits chosen. */
  mutators: string[];
  /** Upgrades purchased. */
  upgrades: string[];
  /** Ship blueprint name. */
  shipName: string;
  /** Crisis events encountered (choice ids). */
  crisisChoices: string[];
  /** Nemesis kills this run. */
  nemesisKills: number;
  /** Number of rift events survived. */
  riftsSurvived: number;
}

export interface PilotTitle {
  id: string;
  displayName: string;
  icon: string;
  description: string;
  /** Check if the pilot has earned this title. */
  check: (history: RunRecord[], lifetime: LifetimeStats) => boolean;
}

export interface LifetimeStats {
  totalRuns: number;
  totalKills: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalTimeSeconds: number;
  totalCreditsEarned: number;
  totalBossKills: number;
  totalEliteKills: number;
  totalBlueprintsSalvaged: number;
  bestWave: number;
  bestScore: number;
  bestCombo: number;
  bestGrade: string;
  sGrades: number;
  aGrades: number;
  totalNearMisses: number;
  bestNearMissStreak: number;
  totalOverdrives: number;
  totalDashes: number;
}

// ── Storage ───────────────────────────────────────────────────

const CHRONICLE_STORAGE_KEY = 'spachip3js.chronicle';
const MAX_STORED_RUNS = 100;
const PILOT_TITLE_KEY = 'spachip3js.pilotTitle';

// ── Run Persistence ──────────────────────────────────────────

export function persistRunRecords(records: RunRecord[]): void {
  try {
    const trimmed = records.slice(0, MAX_STORED_RUNS);
    window.localStorage.setItem(CHRONICLE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* storage full or unavailable — silently skip */ }
}

export function saveRunRecord(record: RunRecord): void {
  const existing = loadAllRecords();
  existing.unshift(record);
  persistRunRecords(existing);
}

export function loadAllRecords(): RunRecord[] {
  try {
    const raw = window.localStorage.getItem(CHRONICLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadRecentRuns(limit = 10): RunRecord[] {
  return loadAllRecords().slice(0, limit);
}

export function deleteRunRecord(id: string): void {
  try {
    const existing = loadAllRecords();
    const filtered = existing.filter((r) => r.id !== id);
    window.localStorage.setItem(CHRONICLE_STORAGE_KEY, JSON.stringify(filtered));
  } catch { /* skip */ }
}

export function clearChronicle(): void {
  try {
    window.localStorage.removeItem(CHRONICLE_STORAGE_KEY);
  } catch { /* skip */ }
}

// ── Lifetime Stats ───────────────────────────────────────────

export function computeLifetimeStats(records: RunRecord[]): LifetimeStats {
  const empty: LifetimeStats = {
    totalRuns: 0,
    totalKills: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    totalTimeSeconds: 0,
    totalCreditsEarned: 0,
    totalBossKills: 0,
    totalEliteKills: 0,
    totalBlueprintsSalvaged: 0,
    bestWave: 0,
    bestScore: 0,
    bestCombo: 0,
    bestGrade: '',
    sGrades: 0,
    aGrades: 0,
    totalNearMisses: 0,
    bestNearMissStreak: 0,
    totalOverdrives: 0,
    totalDashes: 0,
  };

  const gradeOrder: Record<string, number> = { D: 0, C: 1, B: 2, A: 3, S: 4 };
  const gradeIdx = (g: string) => gradeOrder[g] ?? -1;

  return records.reduce((acc, r) => ({
    totalRuns: acc.totalRuns + 1,
    totalKills: acc.totalKills + r.stats.totalKills,
    totalDamageDealt: acc.totalDamageDealt + r.stats.damageDealt,
    totalDamageTaken: acc.totalDamageTaken + r.stats.damageTaken,
    totalTimeSeconds: acc.totalTimeSeconds + r.stats.timeSeconds,
    totalCreditsEarned: acc.totalCreditsEarned + r.stats.creditsEarned,
    totalBossKills: acc.totalBossKills + r.stats.bossKills,
    totalEliteKills: acc.totalEliteKills + r.stats.eliteKills,
    totalBlueprintsSalvaged: acc.totalBlueprintsSalvaged + r.stats.blueprintsSalvaged,
    bestWave: Math.max(acc.bestWave, r.stats.waveReached),
    bestScore: Math.max(acc.bestScore, r.stats.score),
    bestCombo: Math.max(acc.bestCombo, r.stats.bestCombo),
    bestGrade: gradeIdx(r.grade.letter) > gradeIdx(acc.bestGrade) ? r.grade.letter : acc.bestGrade,
    sGrades: acc.sGrades + (r.grade.letter === 'S' ? 1 : 0),
    aGrades: acc.aGrades + (r.grade.letter === 'A' ? 1 : 0),
    totalNearMisses: acc.totalNearMisses + r.stats.nearMissTotal,
    bestNearMissStreak: Math.max(acc.bestNearMissStreak, r.stats.nearMissBestStreak),
    totalOverdrives: acc.totalOverdrives + r.stats.overdriveActivations,
    totalDashes: acc.totalDashes + r.stats.dashCount,
  }), empty);
}

// ── Pilot Title Catalog ──────────────────────────────────────
//
// Titles are cosmetic labels the player can equip to express their
// identity. They're earned through cumulative and single-run achievements
// across different playstyles.

export const PILOT_TITLES: PilotTitle[] = [
  // ── Combat Titles ──
  {
    id: 'first_blood_title',
    displayName: 'Blooded',
    icon: '⚔️',
    description: 'Complete your first endless run',
    check: (history) => history.length >= 1,
  },
  {
    id: 'centurion_title',
    displayName: 'Centurion',
    icon: '💀',
    description: 'Accumulate 100 total kills across all runs',
    check: (_h, lt) => lt.totalKills >= 100,
  },
  {
    id: 'butcher_title',
    displayName: 'The Butcher',
    icon: '🔥',
    description: 'Accumulate 1,000 total kills',
    check: (_h, lt) => lt.totalKills >= 1000,
  },
  {
    id: 'godslayer_title',
    displayName: 'Godslayer',
    icon: '👑',
    description: 'Kill 3 or more bosses in a single run',
    check: (history) => history.some((r) => r.stats.bossKills >= 3),
  },
  {
    id: 'elite_hunter_title',
    displayName: 'Elite Hunter',
    icon: '🎯',
    description: 'Kill 10 or more elites in a single run',
    check: (history) => history.some((r) => r.stats.eliteKills >= 10),
  },
  {
    id: 'massacre_title',
    displayName: 'Architect of Ruin',
    icon: '☠️',
    description: 'Achieve a 20x GODLIKE combo in any run',
    check: (history) => history.some((r) => r.stats.bestCombo >= 20),
  },

  // ── Survival Titles ──
  {
    id: 'wave_ten_title',
    displayName: 'Wave Veteran',
    icon: '🌊',
    description: 'Reach wave 10 in any run',
    check: (history) => history.some((r) => r.stats.waveReached >= 10),
  },
  {
    id: 'wave_twenty_title',
    displayName: 'Tidebreaker',
    icon: '🌊',
    description: 'Reach wave 20 in any run',
    check: (history) => history.some((r) => r.stats.waveReached >= 20),
  },
  {
    id: 'survivor_title',
    displayName: 'Survivor',
    icon: '🛡️',
    description: 'Complete 10 endless runs',
    check: (history) => history.length >= 10,
  },
  {
    id: 'untouchable_title',
    displayName: 'Untouchable',
    icon: '✨',
    description: 'Clear wave 5+ with 80%+ HP remaining in any run',
    check: (history) => history.some(
      (r) => r.stats.waveReached >= 5 && r.stats.maxHp > 0
        && (r.stats.hpRemaining / r.stats.maxHp) >= 0.8,
    ),
  },

  // ── Style Titles ──
  {
    id: 'bullet_dancer_title',
    displayName: 'Bullet Dancer',
    icon: '💫',
    description: 'Dodge 50+ near-misses in a single run',
    check: (history) => history.some((r) => r.stats.nearMissTotal >= 50),
  },
  {
    id: 'phantom_title',
    displayName: 'Phantom',
    icon: '👻',
    description: 'Achieve a 5+ near-miss streak in any run',
    check: (history) => history.some((r) => r.stats.nearMissBestStreak >= 5),
  },
  {
    id: 'efficient_title',
    displayName: 'Surgeon',
    icon: '⚕️',
    description: 'Achieve 5x+ damage efficiency (dealt/taken) in any run',
    check: (history) => history.some(
      (r) => r.stats.damageTaken > 0 && (r.stats.damageDealt / r.stats.damageTaken) >= 5,
    ),
  },
  {
    id: 'dash_master_title',
    displayName: 'Slipstream',
    icon: '💨',
    description: 'Use dash 50+ times in a single run',
    check: (history) => history.some((r) => r.stats.dashCount >= 50),
  },

  // ── Mastery Titles ──
  {
    id: 'legendary_title',
    displayName: 'Legendary',
    icon: '🌟',
    description: 'Earn an S grade on any run',
    check: (history) => history.some((r) => r.grade.letter === 'S'),
  },
  {
    id: 'consistent_title',
    displayName: 'Consistent',
    icon: '🏆',
    description: 'Earn A or S grades on 3+ runs',
    check: (history) => history.filter((r) => r.grade.letter === 'A' || r.grade.letter === 'S').length >= 3,
  },
  {
    id: 'mutated_title',
    displayName: 'Mutated',
    icon: '🧬',
    description: 'Complete a run with 3 mutator traits active',
    check: (history) => history.some((r) => r.mutators.length >= 3),
  },
  {
    id: 'scavenger_title',
    displayName: 'Scavenger',
    icon: '🔧',
    description: 'Salvage 3+ blueprints in a single run',
    check: (history) => history.some((r) => r.stats.blueprintsSalvaged >= 3),
  },
  {
    id: 'veteran_title',
    displayName: 'Veteran Pilot',
    icon: '🎖️',
    description: 'Complete 25 endless runs',
    check: (history) => history.length >= 25,
  },
  {
    id: 'ten_thousand_title',
    displayName: 'Ten Thousand',
    icon: '🔰',
    description: 'Accumulate 10,000 total kills across all runs',
    check: (_h, lt) => lt.totalKills >= 10000,
  },
];

// ── Title Management ─────────────────────────────────────────

export function getEarnedTitles(history: RunRecord[], lifetime: LifetimeStats): PilotTitle[] {
  return PILOT_TITLES.filter((t) => t.check(history, lifetime));
}

export function getTitleDef(id: string): PilotTitle | undefined {
  return PILOT_TITLES.find((t) => t.id === id);
}

export function getSelectedTitle(): string | null {
  try {
    return window.localStorage.getItem(PILOT_TITLE_KEY);
  } catch {
    return null;
  }
}

export function setSelectedTitle(titleId: string | null): void {
  try {
    if (titleId) {
      window.localStorage.setItem(PILOT_TITLE_KEY, titleId);
    } else {
      window.localStorage.removeItem(PILOT_TITLE_KEY);
    }
  } catch { /* skip */ }
}

// ── Run Record Builder ───────────────────────────────────────

export function buildRunRecord(opts: {
  stats: RunStats;
  shipName: string;
  sigil: { id: string; tier: number } | null;
  mutators: string[];
  upgrades: string[];
  crisisChoices: string[];
  nemesisKills?: number;
  riftsSurvived?: number;
}): RunRecord {
  const { stats } = opts;
  const grade = computeRunGrade(stats);
  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt: new Date().toISOString(),
    stats,
    grade,
    causeOfDeath: getCauseOfDeath(stats),
    sigil: opts.sigil,
    mutators: opts.mutators,
    upgrades: opts.upgrades,
    shipName: opts.shipName,
    crisisChoices: opts.crisisChoices,
    nemesisKills: opts.nemesisKills ?? 0,
    riftsSurvived: opts.riftsSurvived ?? 0,
  };
}

// ── Summary Helpers ──────────────────────────────────────────

export function getChronicleSummary(records: RunRecord[]): {
  totalRuns: number;
  recentGrade: RunGrade | null;
  bestGrade: string;
  bestWave: number;
  earnedTitles: number;
  totalTitles: number;
} {
  const lt = computeLifetimeStats(records);
  const earned = getEarnedTitles(records, lt);
  return {
    totalRuns: records.length,
    recentGrade: records.length > 0 ? records[0].grade : null,
    bestGrade: lt.bestGrade,
    bestWave: lt.bestWave,
    earnedTitles: earned.length,
    totalTitles: PILOT_TITLES.length,
  };
}
