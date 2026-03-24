// ── Kill Combo / Streak System ─────────────────────────────────
//
// Tracks rapid consecutive enemy kills and rewards the player with
// escalating credit multipliers and score bonuses.
//
// Combo tiers:
//   0-1 kills  → x1    (no bonus)
//   2-4 kills  → x1.5  "Double Tap"
//   5-9 kills  → x2    "On Fire"
//   10-14 kills → x3   "Unstoppable"
//   15-19 kills → x4   "Massacre"
//   20+ kills  → x5    " GODLIKE"
//
// Combo resets after COMBO_TIMEOUT seconds without a kill.
// Combo is only active in endless mode.
//
// Credit multiplier: applied to wave-clear credits proportional to
// the active combo at wave-clear time.
// Score bonus: each kill within a combo grants bonus score.

export interface ComboState {
  kills: number;
  timer: number;
  bestKills: number;
  totalComboScore: number;
  tierAnnouncement: string;
  tierAnnouncementTimer: number;
  /** Extra seconds added to the combo timeout from legacy bonuses. */
  timeoutBonus: number;
}

export interface ComboTier {
  minKills: number;
  multiplier: number;
  label: string;
  color: string;
  icon: string;
}

export const COMBO_TIERS: ComboTier[] = [
  { minKills: 0,  multiplier: 1,   label: 'Ready',       color: '#94a3b8', icon: '🎯' },
  { minKills: 2,  multiplier: 1.5, label: 'Double Tap',  color: '#fbbf24', icon: '⚔️' },
  { minKills: 5,  multiplier: 2,   label: 'On Fire',     color: '#f97316', icon: '🔥' },
  { minKills: 10, multiplier: 3,   label: 'Unstoppable', color: '#ef4444', icon: '💥' },
  { minKills: 15, multiplier: 4,   label: 'Massacre',    color: '#dc2626', icon: '💀' },
  { minKills: 20, multiplier: 5,   label: 'GODLIKE',     color: '#a855f7', icon: '⚡' },
];

/** Seconds before combo resets without a kill. */
const COMBO_TIMEOUT = 4.0;

/** Base score per kill within a combo (scaled by tier). */
const COMBO_SCORE_PER_KILL = 25;

export function createComboState(timeoutBonus = 0): ComboState {
  return {
    kills: 0,
    timer: 0,
    bestKills: 0,
    totalComboScore: 0,
    tierAnnouncement: '',
    tierAnnouncementTimer: 0,
    timeoutBonus,
  };
}

/**
 * Get the current combo tier based on kill count.
 */
export function getComboTier(kills: number): ComboTier {
  let tier = COMBO_TIERS[0];
  for (const t of COMBO_TIERS) {
    if (kills >= t.minKills) tier = t;
  }
  return tier;
}

/**
 * Register an enemy kill. Returns updated combo state.
 * Returns a `tierUp` flag if the kill caused a tier upgrade.
 */
export function registerComboKill(state: ComboState): { state: ComboState; tierUp: boolean } {
  const prevTier = getComboTier(state.kills);
  const newKills = state.kills + 1;
  const newTier = getComboTier(newKills);

  const newTimer = newTier.minKills > 0
    ? COMBO_TIMEOUT + state.timeoutBonus + Math.min(newKills * 0.15, 2)   // longer timer at higher combos
    : 0;

  const scoreGain = newTier.minKills > 0
    ? COMBO_SCORE_PER_KILL * Math.floor(newTier.multiplier)
    : 0;

  const tierUp = newTier.minKills > prevTier.minKills && newTier.minKills > 0;
  const newBest = Math.max(state.bestKills, newKills);

  const newState: ComboState = {
    kills: newKills,
    timer: newTimer,
    bestKills: newBest,
    totalComboScore: state.totalComboScore + scoreGain,
    tierAnnouncement: tierUp ? `${newTier.icon} ${newTier.label} x${newTier.multiplier}` : state.tierAnnouncement,
    tierAnnouncementTimer: tierUp ? 2.5 : state.tierAnnouncementTimer,
    timeoutBonus: state.timeoutBonus,
  };

  return { state: newState, tierUp };
}

/**
 * Tick the combo timer forward by dt seconds.
 * If timer reaches 0, combo resets.
 */
export function tickCombo(state: ComboState, dt: number): ComboState {
  if (state.kills === 0) return state;

  const newTimer = Math.max(0, state.timer - dt);
  let newKills = state.kills;
  let newTotalScore = state.totalComboScore;

  // Combo expired
  if (newTimer === 0 && state.kills > 0) {
    newKills = 0;
    newTotalScore = state.totalComboScore;
  }

  const newAnnTimer = Math.max(0, state.tierAnnouncementTimer - dt);

  return {
    ...state,
    kills: newKills,
    timer: newTimer,
    totalComboScore: newTotalScore,
    tierAnnouncement: newAnnTimer > 0 ? state.tierAnnouncement : '',
    tierAnnouncementTimer: newAnnTimer,
  };
}

/**
 * Get the credit multiplier from the current combo.
 */
export function getComboCreditMultiplier(kills: number): number {
  return getComboTier(kills).multiplier;
}

/**
 * Get the timer as a fraction (0-1) for UI display.
 */
export function getComboTimerFraction(state: ComboState): number {
  if (state.kills === 0) return 0;
  // Reconstruct the max timer for current kill count
  const tier = getComboTier(state.kills);
  if (tier.minKills === 0) return 0;
  const maxTimer = COMBO_TIMEOUT + state.timeoutBonus + Math.min(state.kills * 0.15, 2);
  return Math.max(0, state.timer / maxTimer);
}

/**
 * Reset combo state (e.g., on run restart).
 */
export function resetCombo(timeoutBonus = 0): ComboState {
  return createComboState(timeoutBonus);
}
