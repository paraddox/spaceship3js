// ── Dash / Evade Mechanic ───────────────────────────────────────
//
// A short-range burst movement ability that gives the player a skill-
// based repositioning tool. Bound to Space by default.
//
// Dash properties:
// - Instant burst of speed in the current movement direction
// - Short invulnerability window during the dash (0.2s) — projectiles pass through
// - Brief afterimage trail VFX
// - Cooldown of 2.5s (reduced by upgrades)
// - If no directional input, dashes forward (ship facing direction)
//
// Strategic interactions:
// - Dash through damage nebula → 2x projectile damage boost for 2s
// - Dash through asteroid → phase through (no collision)
// - Dash through shield conduit → instant full recharge
// - These interactions reward spatial awareness and risk/reward play

export interface DashState {
  /** Whether the player is currently in a dash */
  active: boolean;
  /** Seconds remaining on invulnerability window */
  invulnRemaining: number;
  /** Cooldown seconds remaining before next dash is available */
  cooldownRemaining: number;
  /** Full cooldown duration in seconds */
  cooldownDuration: number;
  /** Dash duration in seconds */
  dashDuration: number;
  /** Timer for the current dash (counts down from dashDuration) */
  dashTimer: number;
  /** Seconds of invulnerability after dash starts */
  invulnDuration: number;
  /** Dash speed multiplier (applied to current thrust) */
  speedMultiplier: number;
  /** Direction of the current/last dash (world-space unit vector) */
  dashDirX: number;
  dashDirZ: number;
  /** Whether dash passed through a damage nebula this activation */
  nebulaBoostRemaining: number;
  /** Whether dash passed through a shield conduit this activation */
  conduitRestoreApplied: boolean;
}

export function createDashState(): DashState {
  return {
    active: false,
    invulnRemaining: 0,
    cooldownRemaining: 0,
    cooldownDuration: 2.5,
    dashDuration: 0.15,
    dashTimer: 0,
    invulnDuration: 0.2,
    speedMultiplier: 4.5,
    dashDirX: 0,
    dashDirZ: -1,
    nebulaBoostRemaining: 0,
    conduitRestoreApplied: false,
  };
}

export function canDash(state: DashState): boolean {
  return !state.active && state.cooldownRemaining <= 0;
}

export function startDash(
  state: DashState,
  forwardX: number,
  forwardZ: number,
  strafeX: number,
  strafeZ: number,
  shipRotation: number,
  cooldownReduction: number,
): DashState {
  // Determine dash direction: use movement input if present, else face direction
  let dirX = 0;
  let dirZ = 0;

  const inputLen = Math.hypot(forwardX + strafeX, forwardZ + strafeZ);
  if (inputLen > 0.1) {
    dirX = (forwardX + strafeX) / inputLen;
    dirZ = (forwardZ + strafeZ) / inputLen;
  } else {
    // Dash in the direction the ship is facing
    dirX = Math.sin(shipRotation);
    dirZ = Math.cos(shipRotation);
  }

  return {
    ...state,
    active: true,
    dashTimer: state.dashDuration,
    invulnRemaining: state.invulnDuration,
    cooldownRemaining: state.cooldownDuration * Math.max(0.5, 1 - cooldownReduction),
    dashDirX: dirX,
    dashDirZ: dirZ,
    nebulaBoostRemaining: 0,
    conduitRestoreApplied: false,
  };
}

export function updateDash(state: DashState, dt: number): DashState {
  // Always tick cooldown, invuln, and nebula boost
  const newCooldown = Math.max(0, state.cooldownRemaining - dt);
  const newInvuln = Math.max(0, state.invulnRemaining - dt);
  const newNebula = Math.max(0, state.nebulaBoostRemaining - dt);

  if (state.active) {
    const newTimer = state.dashTimer - dt;
    const stillActive = newTimer > 0;

    return {
      ...state,
      active: stillActive,
      dashTimer: Math.max(0, newTimer),
      cooldownRemaining: newCooldown,
      invulnRemaining: newInvuln,
      nebulaBoostRemaining: newNebula,
    };
  }

  return { ...state, cooldownRemaining: newCooldown, invulnRemaining: newInvuln, nebulaBoostRemaining: newNebula };
}

const INVULN_EPSILON = 0.005;

export function isInvulnerable(state: DashState): boolean {
  return state.invulnRemaining > INVULN_EPSILON;
}

export function isDashing(state: DashState): boolean {
  return state.active;
}

export function triggerNebulaBoost(state: DashState): DashState {
  return { ...state, nebulaBoostRemaining: 2 };
}

export function triggerConduitRestore(state: DashState): DashState {
  return { ...state, conduitRestoreApplied: true };
}

export function getDashProgress(state: DashState): number {
  if (state.active) return 1;
  if (state.cooldownRemaining <= 0) return 1;
  return 1 - state.cooldownRemaining / state.cooldownDuration;
}
