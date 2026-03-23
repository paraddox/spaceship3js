// ── Overdrive System ───────────────────────────────────────────
//
// Time-dilation power mode that charges from combo kills.
// When activated, time slows for enemies/projectiles while the player
// moves at full speed with tripled damage and doubled fire rate.
//
// Design:
//   - Charges from combo kills (higher combo tier = more charge)
//   - Activation: press V (consumed instantly)
//   - Duration: 4 seconds of overdrive
//   - During overdrive:
//     * Enemy/projectile time scale: 0.25x (everything else slows)
//     * Player damage: 3x
//     * Player fire rate: 2x
//     * Visual: screen tint, intensified bloom, particle burst
//     * Audio: activation chord, low drone during, deactivation fade
//   - After overdrive: 12-second cooldown before charge resumes
//
// The combo system is the fuel source — sustaining combos fills the
// meter faster, rewarding aggressive play. Players must choose when
// to spend their built-up charge for maximum impact.

export enum OverdrivePhase {
  /** Meter is charging from combo kills. */
  Charging = 'charging',
  /** Overdrive is active — time is dilated. */
  Active = 'active',
  /** Overdrive just ended — cooldown before charge resumes. */
  Cooldown = 'cooldown',
}

export interface OverdriveState {
  phase: OverdrivePhase;
  /** Current charge (0–1). When full, overdrive can be activated. */
  charge: number;
  /** Seconds remaining in overdrive. */
  activeTimer: number;
  /** Seconds remaining in cooldown. */
  cooldownTimer: number;
}

/** How many seconds overdrive lasts. */
export const OVERDRIVE_DURATION = 4.0;

/** Seconds of cooldown after overdrive ends. */
export const OVERDRIVE_COOLDOWN = 12.0;

/** Time scale applied to enemies/projectiles during overdrive. */
export const OVERDRIVE_TIME_SCALE = 0.25;

/** Damage multiplier during overdrive. */
export const OVERDRIVE_DAMAGE_MULT = 3.0;

/** Fire rate multiplier during overdrive. */
export const OVERDRIVE_FIRE_RATE_MULT = 2.0;

/**
 * Charge gained per combo kill.
 * Multiplied by the combo tier multiplier so higher streaks charge faster.
 */
export const OVERDRIVE_CHARGE_PER_KILL = 0.08;

/** Charge needed to activate overdrive (0–1). */
export const OVERDRIVE_FULL_CHARGE = 1.0;

export function createOverdriveState(): OverdriveState {
  return {
    phase: OverdrivePhase.Charging,
    charge: 0,
    activeTimer: 0,
    cooldownTimer: 0,
  };
}

/**
 * Add charge from a combo kill.
 * @param chargeAmount Raw charge to add (typically OVERDRIVE_CHARGE_PER_KILL * comboTierMultiplier)
 */
export function addOverdriveCharge(state: OverdriveState, chargeAmount: number): OverdriveState {
  if (state.phase !== OverdrivePhase.Charging) return state;
  return {
    ...state,
    charge: Math.min(OVERDRIVE_FULL_CHARGE, state.charge + chargeAmount),
  };
}

/**
 * Activate overdrive if meter is full and in charging phase.
 * Returns the new state (unchanged if can't activate).
 */
export function activateOverdrive(state: OverdriveState): OverdriveState {
  if (state.phase !== OverdrivePhase.Charging || state.charge < OVERDRIVE_FULL_CHARGE) {
    return state;
  }
  return {
    phase: OverdrivePhase.Active,
    charge: 0,
    activeTimer: OVERDRIVE_DURATION,
    cooldownTimer: 0,
  };
}

/**
 * Tick overdrive state. Call every frame.
 * @param dt Real delta time (seconds)
 * @returns Updated state
 */
export function tickOverdrive(state: OverdriveState, dt: number): OverdriveState {
  switch (state.phase) {
    case OverdrivePhase.Active:
      const remaining = state.activeTimer - dt;
      if (remaining <= 0) {
        return {
          phase: OverdrivePhase.Cooldown,
          charge: 0,
          activeTimer: 0,
          cooldownTimer: OVERDRIVE_COOLDOWN,
        };
      }
      return { ...state, activeTimer: remaining };

    case OverdrivePhase.Cooldown:
      const cdRemaining = state.cooldownTimer - dt;
      if (cdRemaining <= 0) {
        return {
          phase: OverdrivePhase.Charging,
          charge: 0,
          activeTimer: 0,
          cooldownTimer: 0,
        };
      }
      return { ...state, cooldownTimer: cdRemaining };

    case OverdrivePhase.Charging:
      // Charge doesn't decay — it only grows from kills
      return state;
  }
}

/** Whether overdrive is currently active (time dilation in effect). */
export function isOverdriveActive(state: OverdriveState): boolean {
  return state.phase === OverdrivePhase.Active;
}

/** Whether overdrive can be activated right now. */
export function canActivateOverdrive(state: OverdriveState): boolean {
  return state.phase === OverdrivePhase.Charging && state.charge >= OVERDRIVE_FULL_CHARGE;
}

/** Get the time scale that should be applied to enemies/projectiles. */
export function getOverdriveTimeScale(state: OverdriveState): number {
  return isOverdriveActive(state) ? OVERDRIVE_TIME_SCALE : 1;
}

/** Get the damage multiplier for the player. */
export function getOverdriveDamageMult(state: OverdriveState): number {
  return isOverdriveActive(state) ? OVERDRIVE_DAMAGE_MULT : 1;
}

/** Get the fire rate multiplier for the player. */
export function getOverdriveFireRateMult(state: OverdriveState): number {
  return isOverdriveActive(state) ? OVERDRIVE_FIRE_RATE_MULT : 1;
}

/**
 * Get charge fill fraction for HUD (0–1).
 * During cooldown, returns 0 (can't charge).
 */
export function getOverdriveChargeFraction(state: OverdriveState): number {
  return state.phase === OverdrivePhase.Charging ? state.charge : 0;
}

/**
 * Get the remaining fraction (for active/cooldown bars).
 * Active: time remaining / duration
 * Cooldown: 1 - (time remaining / cooldown)
 * Charging: charge fraction
 */
export function getOverdriveProgressFraction(state: OverdriveState): number {
  switch (state.phase) {
    case OverdrivePhase.Active:
      return state.activeTimer / OVERDRIVE_DURATION;
    case OverdrivePhase.Cooldown:
      return 1 - (state.cooldownTimer / OVERDRIVE_COOLDOWN);
    case OverdrivePhase.Charging:
      return state.charge;
  }
}

/** Reset overdrive state (for new run/wave). */
export function resetOverdrive(): OverdriveState {
  return createOverdriveState();
}
