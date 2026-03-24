// ── Near-Miss Bullet Time ──────────────────────────────────
//
// When an enemy projectile passes close to the player without hitting,
// time briefly dilates — slowing enemy projectiles and AI while the
// player stays at full speed. This rewards skilled dodging, creates
// cinematic moments, and ties into the combo system naturally.
//
// Design constraints:
// - Composes with overdrive time scale (multiplies, doesn't replace)
// - Only triggers for enemy projectiles near the real player
// - Cooldown prevents spam during dense barrages
// - Streak tracking creates chase-the-high-score incentive
// - Combo timer bonus rewards consecutive near-misses

// ── Constants ──────────────────────────────────────────────

/** How close (world units) an enemy projectile must pass to trigger. */
export const NEAR_MISS_RADIUS = 1.2;

/** Hit radius to exclude — closer than this is an actual hit, not a near miss. */
export const HIT_RADIUS = 0.55;

/** Slow-motion time scale applied to enemy game clock. */
export const SLOW_MOTION_SCALE = 0.25;

/** How long the slow-motion lasts (seconds). */
export const SLOW_MOTION_DURATION = 0.5;

/** Minimum time between triggers (seconds). */
export const SLOW_MOTION_COOLDOWN = 2.5;

/** Combo timer bonus per near-miss (seconds). */
export const NEAR_MISS_COMBO_BONUS = 0.8;

/** Time window to chain near-misses into a streak (seconds). */
export const STREAK_WINDOW = 2.0;

/** Maximum time scale multiplier from streaks. */
export const MAX_STREAK_SCALE_BONUS = 0.3;

/** Extra slow-mo duration per streak level (seconds). */
export const STREAK_DURATION_BONUS = 0.08;

// ── Types ──────────────────────────────────────────────────

export interface NearMissState {
  /** Whether slow-motion is currently active. */
  active: boolean;
  /** Current slow-motion duration remaining. */
  remaining: number;
  /** Current cooldown (counts down to 0 before next trigger allowed). */
  cooldown: number;
  /** Total near-misses this run. */
  total: number;
  /** Best streak achieved this run. */
  bestStreak: number;
  /** Current streak (resets after STREAK_WINDOW with no near-miss). */
  currentStreak: number;
  /** Time since last near-miss (for streak decay). */
  timeSinceLastMiss: number;
}

// ── State Management ───────────────────────────────────────

export function createNearMissState(): NearMissState {
  return {
    active: false,
    remaining: 0,
    cooldown: 0,
    total: 0,
    bestStreak: 0,
    currentStreak: 0,
    timeSinceLastMiss: 999,
  };
}

/**
 * Check if an enemy projectile passing the player at `distance` qualifies
 * as a near-miss and is not on cooldown.
 */
export function checkNearMiss(
  state: NearMissState,
  distance: number,
): { triggered: boolean; newState: NearMissState } {
  // Must be in the near-miss zone but outside hit zone
  if (distance > NEAR_MISS_RADIUS || distance <= HIT_RADIUS) {
    return { triggered: false, newState: state };
  }
  // Must be off cooldown
  if (state.cooldown > 0) {
    return { triggered: false, newState: state };
  }
  // Don't re-trigger while already in slow-mo
  if (state.active) {
    return { triggered: false, newState: state };
  }

  const newStreak = state.timeSinceLastMiss <= STREAK_WINDOW
    ? state.currentStreak + 1
    : 1;
  const duration = SLOW_MOTION_DURATION + Math.min(newStreak - 1, 10) * STREAK_DURATION_BONUS;

  return {
    triggered: true,
    newState: {
      ...state,
      active: true,
      remaining: duration,
      cooldown: SLOW_MOTION_COOLDOWN,
      total: state.total + 1,
      currentStreak: newStreak,
      bestStreak: Math.max(state.bestStreak, newStreak),
      timeSinceLastMiss: 0,
    },
  };
}

/**
 * Tick the near-miss state forward. Returns the time scale multiplier
 * to apply to enemy game-clock systems (projectiles, AI, etc.).
 *
 * Returns 1.0 when inactive, SLOW_MOTION_SCALE when active (smoothly
 * lerped in the first 80ms for a cinematic ramp).
 */
export function tickNearMiss(state: NearMissState, dt: number): {
  state: NearMissState;
  timeScale: number;
} {
  let timeSinceLastMiss = state.timeSinceLastMiss + dt;
  let currentStreak = state.currentStreak;

  // Streak decay
  if (currentStreak > 0 && timeSinceLastMiss > STREAK_WINDOW) {
    currentStreak = 0;
  }

  if (!state.active) {
    return {
      state: {
        ...state,
        cooldown: Math.max(0, state.cooldown - dt),
        timeSinceLastMiss,
        currentStreak,
      },
      timeScale: 1,
    };
  }

  const newRemaining = state.remaining - dt;
  if (newRemaining <= 0) {
    return {
      state: {
        ...state,
        active: false,
        remaining: 0,
        cooldown: SLOW_MOTION_COOLDOWN,
        timeSinceLastMiss,
        currentStreak,
      },
      timeScale: 1,
    };
  }

  // Smooth ramp: first 80ms eases into slow-mo
  const elapsed = state.remaining - newRemaining;
  const ramp = Math.min(1, elapsed / 0.08);
  const eased = ramp * ramp * (3 - 2 * ramp); // smoothstep
  const scale = 1 + (SLOW_MOTION_SCALE - 1) * eased;

  return {
    state: {
      ...state,
      remaining: newRemaining,
      timeSinceLastMiss,
      currentStreak,
    },
    timeScale: scale,
  };
}

/**
 * Get the combo timer bonus from a near-miss trigger.
 * Only meaningful when `triggered` is true from `checkNearMiss`.
 */
export function getNearMissComboBonus(streak: number): number {
  return NEAR_MISS_COMBO_BONUS + Math.min(streak - 1, 5) * 0.15;
}

/**
 * Get the total time scale multiplier for enemy systems,
 * composing near-miss slow-mo with overdrive.
 * Near-miss slows enemies; overdrive slows enemies for player benefit.
 * The effects multiply: both active = enemies at 25% * 50% = 12.5% speed.
 */
export function getEnemyTimeScale(
  overdriveScale: number,
  nearMissScale: number,
): number {
  return overdriveScale * nearMissScale;
}
