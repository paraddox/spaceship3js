// ── Run Report Card ─────────────────────────────────────────────
//
// A rich post-run breakdown shown when the player dies in endless mode.
// Tracks stats throughout the run, computes a grade (S/A/B/C/D),
// and highlights peak performance moments.
//
// The report card serves three purposes:
// 1. Feedback — "here's how you did" (stats, grade)
// 2. Narrative — "here's your story" (cause of death, peak moments)
// 3. Motivation — "here's what to try next" (grade-based suggestions)

export interface RunStats {
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
}

export interface RunGrade {
  letter: string;
  color: string;
  label: string;
}

export const RUN_GRADES: RunGrade[] = [
  { letter: 'S', color: '#fbbf24', label: 'Legendary' },
  { letter: 'A', color: '#4ade80', label: 'Excellent' },
  { letter: 'B', color: '#38bdf8', label: 'Great' },
  { letter: 'C', color: '#94a3b8', label: 'Good' },
  { letter: 'D', color: '#fb923c', label: 'Rough' },
];

export const DEFAULT_RUN_STATS: RunStats = {
  waveReached: 0,
  totalKills: 0,
  eliteKills: 0,
  bossKills: 0,
  score: 0,
  creditsEarned: 0,
  timeSeconds: 0,
  bestCombo: 0,
  highestComboTier: 'Ready',
  damageDealt: 0,
  damageTaken: 0,
  pickupsCollected: 0,
  hpRemaining: 0,
  maxHp: 0,
  mutatorsChosen: [],
  upgradesPurchased: [],
  overdriveActivations: 0,
  dashCount: 0,
  abilityActivations: 0,
};

/**
 * Compute the run grade based on a weighted score from multiple dimensions.
 * Each dimension contributes 0-100 points. Total is averaged.
 */
export function computeRunGrade(stats: RunStats): RunGrade {
  const waveScore = Math.min(100, stats.waveReached * 3);
  const killScore = Math.min(100, stats.totalKills * 1.5);
  const comboScore = Math.min(100, stats.bestCombo * 5);
  const efficiencyScore = stats.totalKills > 0
    ? Math.min(100, (stats.damageDealt / Math.max(1, stats.damageTaken)) * 5)
    : 0;
  const survivalScore = Math.min(100, stats.timeSeconds / 3);

  const total = (waveScore + killScore + comboScore + efficiencyScore + survivalScore) / 5;

  if (total >= 80) return RUN_GRADES[0]; // S
  if (total >= 60) return RUN_GRADES[1]; // A
  if (total >= 40) return RUN_GRADES[2]; // B
  if (total >= 20) return RUN_GRADES[3]; // C
  return RUN_GRADES[4]; // D
}

/**
 * Format time as M:SS.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format large numbers with K suffix.
 */
export function formatBig(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Get a cause-of-death description based on remaining HP.
 */
export function getCauseOfDeath(stats: RunStats): string {
  const hpPct = stats.maxHp > 0 ? stats.hpRemaining / stats.maxHp : 0;
  if (hpPct <= 0) return 'Hull breached — total structural failure';
  if (hpPct <= 0.15) return 'Critical damage — systems failing';
  if (hpPct <= 0.35) return 'Heavy damage — overwhelmed';
  return 'Ship disabled — forced retreat';
}

/**
 * Get a grade-based suggestion for the next run.
 */
export function getNextRunTip(grade: RunGrade, stats: RunStats): string {
  if (grade.letter === 'S') {
    if (stats.mutatorsChosen.length === 0) return 'Try a mutator trait — they create entirely new playstyles.';
    if (stats.bestCombo < 10) return 'You\'re close to GODLIKE combos — keep the pressure up!';
    return 'Legendary run! Can you push further with a different build?';
  }
  if (grade.letter === 'A') {
    if (stats.damageTaken > stats.damageDealt) return 'Focus on dodging — you\'re taking more than you\'re dealing.';
    if (stats.pickupsCollected < 3) return 'Chase pickups — salvage, shield cells, and repair kits extend runs.';
    return 'Solid run! Try an aggressive mutator like Glass Cannon or Momentum.';
  }
  if (grade.letter === 'B') {
    if (stats.eliteKills === 0) return 'Hunt elite enemies (glowing ones) — they drop bonus credits.';
    if (stats.upgradesPurchased.length < 3) return 'Invest credits in the shop — upgrades compound over a run.';
    return 'Use the dash (Space) to dodge enemy fire and reposition quickly.';
  }
  if (grade.letter === 'C') {
    if (stats.waveReached < 5) return 'Survive early waves by staying mobile — circle-strafe enemies.';
    return 'Pick defensive upgrades (Hull Reinforcement, Shield Amplifier) to survive longer.';
  }
  // D
  return 'Focus on basics: WASD to move, mouse to aim, Space to dash. Pick up repair kits!';
}

/**
 * Compute highlight stats — notable achievements to feature prominently.
 */
export function getHighlights(stats: RunStats): string[] {
  const highlights: string[] = [];

  if (stats.waveReached >= 20) highlights.push(`Survived to wave ${stats.waveReached}`);
  else if (stats.waveReached >= 10) highlights.push(`Reached wave ${stats.waveReached}`);
  if (stats.bestCombo >= 20) highlights.push(`${stats.bestCombo}x GODLIKE combo`);
  else if (stats.bestCombo >= 15) highlights.push(`${stats.bestCombo}x Massacre combo`);
  else if (stats.bestCombo >= 10) highlights.push(`${stats.bestCombo}x Unstoppable combo`);
  if (stats.eliteKills >= 5) highlights.push(`Slayed ${stats.eliteKills} elite enemies`);
  if (stats.bossKills >= 3) highlights.push(`Defeated ${stats.bossKills} boss frigates`);
  if (stats.damageDealt > 0) {
    const ratio = stats.damageDealt / Math.max(1, stats.damageTaken);
    if (ratio >= 5) highlights.push(`${ratio.toFixed(1)}x damage efficiency`);
  }
  if (stats.timeSeconds >= 300) highlights.push(`${formatTime(stats.timeSeconds)} survived`);
  if (stats.mutatorsChosen.length >= 3) highlights.push('Full mutator build');
  if (stats.overdriveActivations >= 3) highlights.push(`Overdrive activated ${stats.overdriveActivations}x`);

  return highlights.slice(0, 3);
}
