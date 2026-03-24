// ── Boss Encounter System ─────────────────────────────────────────
//
// Multi-phase boss fights with telegraphed attacks, vulnerability
// windows, and dramatic phase transitions. Replaces the flat
// "bigger ship" boss waves with actual boss encounters.
//
// Architecture:
//   BossAIState — state machine driving the boss behavior
//   BossPhaseDef — data-driven phase configuration
//   BossAttackDef — individual attack pattern definitions
//   Pure functions: createBossAI, updateBossAI, isBossVulnerable
//
// Phase flow: each phase has HP thresholds. When crossed, the boss
// enters a brief invulnerable transition, then switches behavior.
//
// Attacks: telegraphed (warning period) → execute → cooldown.
// During telegraph, a visible warning circle shows where the attack
// will land, giving the player time to react.
//
// No Three.js imports — pure logic consumed by FlightScene.

// ── Types ─────────────────────────────────────────────────────

export type BossPhaseId = 'assault' | 'cannonade' | 'desperation';

export type BossAttackId =
  | 'barrage'       // Rapid-fire bullets in a spreading cone
  | 'missile_sweep' // Homing missiles fired in a sweeping arc
  | 'beam_sweep'    // Rotating beam that sweeps across the arena
  | 'shockwave'     // Expanding ring of damage from the boss
  | 'charge'        // Boss rushes toward the player at high speed
  | 'mine_field'    // Deploys damage zones around the arena
  | 'ram'           // Teleport → teleport → slam (phase 3 only)
  | 'final_barrage'; // Everything at once (desperation phase)

export interface BossAttackDef {
  id: BossAttackId;
  /** Human-readable name for HUD announcement. */
  displayName: string;
  /** Duration of telegraph/warning phase before damage (seconds). */
  telegraphDuration: number;
  /** Duration of the active attack phase (seconds). */
  activeDuration: number;
  /** Cooldown before this attack can fire again (seconds). */
  cooldown: number;
  /** Base damage per tick/hit during active phase. */
  damage: number;
  /** Radius of the attack area (for AoE types). */
  radius: number;
  /** Whether this attack tracks the player's position. */
  tracksPlayer: boolean;
  /** HUD warning text shown during telegraph. */
  warningText: string;
  /** Warning icon for HUD. */
  warningIcon: string;
}

export interface BossPhaseDef {
  id: BossPhaseId;
  /** Display name. */
  displayName: string;
  /** HP fraction at which this phase begins (0–1, top-down). */
  hpThreshold: number;
  /** Attacks available in this phase. */
  attacks: BossAttackDef[];
  /** Movement speed multiplier (1 = normal). */
  speedMult: number;
  /** Fire rate multiplier for basic attacks. */
  fireRateMult: number;
  /** Damage multiplier for basic attacks. */
  damageMult: number;
  /** Cooldown multiplier for abilities. */
  cooldownMult: number;
  /** Announced when entering this phase. */
  announcement: string;
  /** Whether the boss is invulnerable during phase transition. */
  transitionInvulnerable: boolean;
  /** Phase transition duration (seconds). */
  transitionDuration: number;
}

export interface BossTelegraph {
  attackId: BossAttackId;
  /** World position where the attack will land. */
  position: { x: number; z: number };
  /** Time remaining in telegraph phase (seconds). */
  timeRemaining: number;
  /** Total telegraph duration (for rendering progress). */
  duration: number;
  /** Attack radius for rendering. */
  radius: number;
  /** Whether this telegraph tracks the player. */
  tracksPlayer: boolean;
}

export interface BossAIState {
  /** Which phase the boss is currently in. */
  phase: BossPhaseId;
  /** Which phase index (0, 1, 2). */
  phaseIndex: number;
  /** Is the boss currently transitioning between phases? */
  transitioning: boolean;
  /** Time remaining in transition (seconds). */
  transitionTimer: number;
  /** Cooldown remaining before the next attack can be chosen (seconds). */
  attackCooldown: number;
  /** Currently telegraphing attack (null if idle). */
  telegraphing: BossAttackDef | null;
  /** Time remaining in telegraph phase. */
  telegraphTimer: number;
  /** Currently active attack (null if idle). */
  activeAttack: BossAttackDef | null;
  /** Time remaining in active attack phase. */
  activeAttackTimer: number;
  /** Active telegraph visuals for rendering. */
  telegraphs: BossTelegraph[];
  /** Position of active beam sweep (for rendering). */
  beamSweepAngle: number;
  /** Direction of beam sweep rotation. */
  beamSweepDirection: number;
  /** Charge attack — target position. */
  chargeTarget: { x: number; z: number } | null;
  /** Charge attack — current progress 0..1. */
  chargeProgress: number;
  /** Shockwave — current radius expansion 0..1. */
  shockwaveRadius: number;
  /** Shockwave — max radius. */
  shockwaveMaxRadius: number;
  /** Whether the boss is currently vulnerable. */
  vulnerable: boolean;
  /** Has the boss been defeated? */
  defeated: boolean;
  /** Number of attacks executed in current phase (for cycling). */
  attacksInPhase: number;
  /** Seed for deterministic attack ordering. */
  seed: number;
}

// ── Boss Blueprint Templates ─────────────────────────────────

export const BOSS_ATTACKS: Record<BossAttackId, BossAttackDef> = {
  barrage: {
    id: 'barrage',
    displayName: 'Punisher Barrage',
    telegraphDuration: 0.8,
    activeDuration: 2.0,
    cooldown: 4.0,
    damage: 8,
    radius: 4,
    tracksPlayer: true,
    warningText: 'BARRAGE INCOMING',
    warningIcon: '🔴',
  },
  missile_sweep: {
    id: 'missile_sweep',
    displayName: 'Missile Rain',
    telegraphDuration: 1.2,
    activeDuration: 1.5,
    cooldown: 6.0,
    damage: 12,
    radius: 6,
    tracksPlayer: true,
    warningText: 'MISSILE RAIN',
    warningIcon: '🚀',
  },
  beam_sweep: {
    id: 'beam_sweep',
    displayName: 'Devastator Beam',
    telegraphDuration: 1.5,
    activeDuration: 3.0,
    cooldown: 8.0,
    damage: 15,
    radius: 2,
    tracksPlayer: true,
    warningText: 'BEAM CHARGING',
    warningIcon: '⚡',
  },
  shockwave: {
    id: 'shockwave',
    displayName: 'Shockwave',
    telegraphDuration: 0.6,
    activeDuration: 0.8,
    cooldown: 5.0,
    damage: 10,
    radius: 12,
    tracksPlayer: false,
    warningText: 'SHOCKWAVE',
    warningIcon: '💥',
  },
  charge: {
    id: 'charge',
    displayName: 'Ramming Speed',
    telegraphDuration: 0.7,
    activeDuration: 1.2,
    cooldown: 7.0,
    damage: 20,
    radius: 3,
    tracksPlayer: true,
    warningText: 'CHARGING',
    warningIcon: '🏹',
  },
  mine_field: {
    id: 'mine_field',
    displayName: 'Mine Deployment',
    telegraphDuration: 1.0,
    activeDuration: 2.5,
    cooldown: 9.0,
    damage: 6,
    radius: 2,
    tracksPlayer: false,
    warningText: 'MINES DEPLOYED',
    warningIcon: '💣',
  },
  ram: {
    id: 'ram',
    displayName: 'Phase Shift Strike',
    telegraphDuration: 0.5,
    activeDuration: 1.5,
    cooldown: 6.0,
    damage: 25,
    radius: 3,
    tracksPlayer: true,
    warningText: 'PHASE STRIKE',
    warningIcon: '👁️',
  },
  final_barrage: {
    id: 'final_barrage',
    displayName: 'Final Barrage',
    telegraphDuration: 1.0,
    activeDuration: 3.5,
    cooldown: 10.0,
    damage: 10,
    radius: 8,
    tracksPlayer: true,
    warningText: 'FINAL BARRAGE',
    warningIcon: '☄️',
  },
};

const BOSS_PHASES: BossPhaseDef[] = [
  {
    id: 'assault',
    displayName: 'Assault Protocol',
    hpThreshold: 1.0,
    attacks: [
      BOSS_ATTACKS.barrage,
      BOSS_ATTACKS.missile_sweep,
      BOSS_ATTACKS.charge,
    ],
    speedMult: 1.0,
    fireRateMult: 1.0,
    damageMult: 1.0,
    cooldownMult: 1.0,
    announcement: '⚠ BOSS ENGAGED — Assault Protocol',
    transitionInvulnerable: false,
    transitionDuration: 0,
  },
  {
    id: 'cannonade',
    displayName: 'Heavy Cannonade',
    hpThreshold: 0.55,
    attacks: [
      BOSS_ATTACKS.barrage,
      BOSS_ATTACKS.missile_sweep,
      BOSS_ATTACKS.beam_sweep,
      BOSS_ATTACKS.shockwave,
      BOSS_ATTACKS.mine_field,
    ],
    speedMult: 1.15,
    fireRateMult: 1.25,
    damageMult: 1.2,
    cooldownMult: 0.85,
    announcement: '⚠ PHASE 2 — Heavy Cannonade',
    transitionInvulnerable: true,
    transitionDuration: 2.0,
  },
  {
    id: 'desperation',
    displayName: 'Desperation Mode',
    hpThreshold: 0.25,
    attacks: [
      BOSS_ATTACKS.beam_sweep,
      BOSS_ATTACKS.shockwave,
      BOSS_ATTACKS.charge,
      BOSS_ATTACKS.ram,
      BOSS_ATTACKS.final_barrage,
    ],
    speedMult: 1.35,
    fireRateMult: 1.5,
    damageMult: 1.5,
    cooldownMult: 0.7,
    announcement: '⚠ PHASE 3 — Desperation Mode',
    transitionInvulnerable: true,
    transitionDuration: 2.5,
  },
];

// ── State Creation ───────────────────────────────────────────

const EPSILON = 0.005;

export function createBossAI(waveNumber: number): BossAIState {
  return {
    phase: 'assault',
    phaseIndex: 0,
    transitioning: false,
    transitionTimer: 0,
    attackCooldown: 2.0, // initial grace period
    telegraphing: null,
    telegraphTimer: 0,
    activeAttack: null,
    activeAttackTimer: 0,
    telegraphs: [],
    beamSweepAngle: 0,
    beamSweepDirection: 1,
    chargeTarget: null,
    chargeProgress: 0,
    shockwaveRadius: 0,
    shockwaveMaxRadius: 0,
    vulnerable: true,
    defeated: false,
    attacksInPhase: 0,
    seed: waveNumber * 37 + 7,
  };
}

// ── Deterministic random helper ──────────────────────────────

function bossRandom(seed: number): number {
  const x = Math.sin(seed * 12345.6789 + 98765.4321) * 43758.5453;
  return x - Math.floor(x);
}

// ── Phase Checking ───────────────────────────────────────────

/**
 * Get the correct phase for a given HP fraction.
 * Returns the phase index (0, 1, or 2).
 */
export function getPhaseForHp(hpFraction: number): number {
  for (let i = BOSS_PHASES.length - 1; i >= 0; i--) {
    if (hpFraction <= BOSS_PHASES[i].hpThreshold) return i;
  }
  return 0;
}

/**
 * Get the phase definition for a given index.
 */
export function getPhaseDef(index: number): BossPhaseDef {
  return BOSS_PHASES[Math.min(index, BOSS_PHASES.length - 1)];
}

/**
 * Check if the boss should transition to a new phase.
 */
export function shouldTransitionPhase(currentIndex: number, hpFraction: number): boolean {
  const newPhase = getPhaseForHp(hpFraction);
  return newPhase > currentIndex;
}

// ── Attack Selection ─────────────────────────────────────────

/**
 * Pick the next attack from the current phase's pool.
 * Cycles through attacks to avoid repetition.
 */
function pickNextAttack(state: BossAIState): BossAttackDef | null {
  const phaseDef = getPhaseDef(state.phaseIndex);
  if (phaseDef.attacks.length === 0) return null;

  const index = state.attacksInPhase % phaseDef.attacks.length;
  // Add some variation based on seed + attack count
  const variantIndex = Math.floor(
    bossRandom(state.seed + state.attacksInPhase * 13 + state.phaseIndex * 7) * phaseDef.attacks.length
  );
  const finalIndex = (index + variantIndex) % phaseDef.attacks.length;
  return phaseDef.attacks[finalIndex];
}

// ── Boss AI Update ───────────────────────────────────────────

/**
 * Main update tick for boss AI.
 *
 * @param state Current boss AI state
 * @param dt Delta time in seconds
 * @param bossHp Current HP
 * @param bossMaxHp Maximum HP
 * @param bossPos Boss position {x, z}
 * @param playerPos Player position {x, z}
 * @returns Updated BossAIState
 */
export function updateBossAI(
  state: BossAIState,
  dt: number,
  bossHp: number,
  bossMaxHp: number,
  bossPos: { x: number; z: number },
  playerPos: { x: number; z: number },
): BossAIState {
  if (state.defeated) return state;

  const hpFraction = bossMaxHp > 0 ? bossHp / bossMaxHp : 0;
  let s = { ...state };

  // ── Check for phase transition ──
  if (shouldTransitionPhase(s.phaseIndex, hpFraction)) {
    const newPhaseIndex = getPhaseForHp(hpFraction);
    const newPhaseDef = getPhaseDef(newPhaseIndex);
    s = {
      ...s,
      phase: newPhaseDef.id,
      phaseIndex: newPhaseIndex,
      transitioning: newPhaseDef.transitionInvulnerable,
      transitionTimer: newPhaseDef.transitionDuration,
      vulnerable: !newPhaseDef.transitionInvulnerable,
      telegraphing: null,
      telegraphTimer: 0,
      activeAttack: null,
      activeAttackTimer: 0,
      telegraphs: [],
      attacksInPhase: 0,
      beamSweepAngle: 0,
      chargeTarget: null,
      chargeProgress: 0,
      shockwaveRadius: 0,
      // Announce phase change (handled by FlightScene via transitionTimer)
    };
  }

  // ── Phase transition countdown ──
  if (s.transitioning) {
    const newTimer = Math.max(0, s.transitionTimer - dt);
    if (newTimer <= EPSILON) {
      s = {
        ...s,
        transitioning: false,
        transitionTimer: 0,
        vulnerable: true,
        attackCooldown: 1.5, // grace period after transition
      };
    } else {
      s = { ...s, transitionTimer: newTimer };
    }
    return s;
  }

  // ── Update telegraph timers ──
  const trackedTelegraphs = s.telegraphs.map((t) => ({
    ...t,
    timeRemaining: t.timeRemaining - dt,
    // Update tracking position
    position: t.tracksPlayer
      ? { x: playerPos.x, z: playerPos.z }
      : t.position,
  }));
  const newTelegraphs = trackedTelegraphs.filter((t) => t.timeRemaining > EPSILON);

  // ── Telegraphing phase ──
  if (s.telegraphing) {
    const newTimer = s.telegraphTimer - dt;
    if (newTimer <= EPSILON) {
      // Telegraph complete → attack goes active
      const attack = s.telegraphing;

      // Freeze the final telegraph positions for strike-zone attacks so the
      // active damage area matches what the player just saw.
      const finalTelegraphs = shouldPersistStrikeZones(attack.id)
        ? trackedTelegraphs.filter((t) => t.attackId === attack.id)
        : newTelegraphs.filter((t) => t.attackId !== attack.id);

      // Set up attack-specific state
      let beamSweepAngle = s.beamSweepAngle;
      let beamSweepDirection = s.beamSweepDirection;
      let chargeTarget = s.chargeTarget;
      let chargeProgress = s.chargeProgress;
      let shockwaveRadius = s.shockwaveRadius;
      let shockwaveMaxRadius = s.shockwaveMaxRadius;

      if (attack.id === 'beam_sweep') {
        beamSweepAngle = Math.atan2(
          playerPos.x - bossPos.x,
          playerPos.z - bossPos.z,
        );
        beamSweepDirection = bossRandom(s.seed + s.attacksInPhase * 31) > 0.5 ? 1 : -1;
      }
      if (attack.id === 'charge' || attack.id === 'ram') {
        chargeTarget = { x: playerPos.x, z: playerPos.z };
        chargeProgress = 0;
      }
      if (attack.id === 'shockwave') {
        shockwaveRadius = 0;
        shockwaveMaxRadius = attack.radius;
      }

      s = {
        ...s,
        telegraphing: null,
        telegraphTimer: 0,
        activeAttack: attack,
        activeAttackTimer: attack.activeDuration,
        telegraphs: finalTelegraphs,
        beamSweepAngle,
        beamSweepDirection,
        chargeTarget,
        chargeProgress,
        shockwaveRadius,
        shockwaveMaxRadius,
      };
    } else {
      s = { ...s, telegraphTimer: newTimer, telegraphs: newTelegraphs };
    }
    return s;
  }

  // ── Active attack phase ──
  if (s.activeAttack) {
    const newTimer = s.activeAttackTimer - dt;
    const attack = s.activeAttack;

    // Update active attack state
    let beamSweepAngle = s.beamSweepAngle;
    let chargeProgress = s.chargeProgress;
    let shockwaveRadius = s.shockwaveRadius;
    let chargeTarget = s.chargeTarget;

    if (attack.id === 'beam_sweep') {
      // Rotate beam
      beamSweepAngle += s.beamSweepDirection * dt * 1.8;
    }
    if (attack.id === 'charge' || attack.id === 'ram') {
      // Commit to the target chosen at activation time. Re-targeting mid-dash
      // makes the strike collapse toward the boss instead of finishing the run.
      chargeProgress = Math.min(1, chargeProgress + dt / attack.activeDuration);
    }
    if (attack.id === 'shockwave') {
      shockwaveRadius = Math.min(
        s.shockwaveMaxRadius,
        s.shockwaveRadius + dt * 18,
      );
    }

    if (newTimer <= EPSILON) {
      // Attack complete → cooldown
      const phaseDef = getPhaseDef(s.phaseIndex);
      s = {
        ...s,
        activeAttack: null,
        activeAttackTimer: 0,
        attackCooldown: (attack.cooldown + 0.5) * phaseDef.cooldownMult,
        attacksInPhase: s.attacksInPhase + 1,
        beamSweepAngle: 0,
        beamSweepDirection: 1,
        chargeTarget: null,
        chargeProgress: 0,
        shockwaveRadius: 0,
        shockwaveMaxRadius: 0,
      };
    } else {
      s = {
        ...s,
        activeAttackTimer: newTimer,
        beamSweepAngle,
        chargeProgress,
        shockwaveRadius,
        chargeTarget,
      };
    }
    return s;
  }

  // ── Idle: tick cooldown and pick next attack ──
  const newCooldown = Math.max(0, s.attackCooldown - dt);
  if (newCooldown <= EPSILON) {
    const nextAttack = pickNextAttack(s);
    if (nextAttack) {
      // Start telegraphing
      const newTelegraph: BossTelegraph = {
        attackId: nextAttack.id,
        position: nextAttack.tracksPlayer
          ? { x: playerPos.x, z: playerPos.z }
          : { x: bossPos.x, z: bossPos.z },
        timeRemaining: nextAttack.telegraphDuration,
        duration: nextAttack.telegraphDuration,
        radius: nextAttack.radius,
        tracksPlayer: nextAttack.tracksPlayer,
      };

      // Mine field creates multiple telegraphs
      const extraTelegraphs = nextAttack.id === 'mine_field'
        ? createMineTelegraphs(bossPos, playerPos, s.seed + s.attacksInPhase * 41)
        : [];

      s = {
        ...s,
        attackCooldown: 0,
        telegraphing: nextAttack,
        telegraphTimer: nextAttack.telegraphDuration,
        telegraphs: [newTelegraph, ...extraTelegraphs],
      };
    } else {
      s = { ...s, attackCooldown: newCooldown };
    }
  } else {
    s = { ...s, attackCooldown: newCooldown };
  }

  return s;
}

/**
 * Generate telegraph positions for mine field attack.
 */
function createMineTelegraphs(
  bossPos: { x: number; z: number },
  playerPos: { x: number; z: number },
  seed: number,
): BossTelegraph[] {
  const mines: BossTelegraph[] = [];
  const count = 5 + Math.floor(bossRandom(seed) * 4); // 5–8 mines
  for (let i = 0; i < count; i++) {
    const angle = bossRandom(seed + i * 17) * Math.PI * 2;
    const dist = 4 + bossRandom(seed + i * 23) * 10;
    mines.push({
      attackId: 'mine_field',
      position: {
        x: bossPos.x + Math.cos(angle) * dist,
        z: bossPos.z + Math.sin(angle) * dist,
      },
      timeRemaining: 1.0 + bossRandom(seed + i * 31) * 0.5,
      duration: 1.5,
      radius: 2,
      tracksPlayer: false,
    });
  }
  return mines;
}

function shouldPersistStrikeZones(attackId: BossAttackId): boolean {
  return attackId === 'barrage'
    || attackId === 'missile_sweep'
    || attackId === 'mine_field'
    || attackId === 'final_barrage';
}

function pointInTelegraphedZone(
  telegraphs: BossTelegraph[],
  attackId: BossAttackId,
  point: { x: number; z: number },
): boolean {
  return telegraphs.some((telegraph) => (
    telegraph.attackId === attackId
      && Math.hypot(point.x - telegraph.position.x, point.z - telegraph.position.z) <= telegraph.radius + 0.75
  ));
}

// ── Damage Queries ───────────────────────────────────────────

/**
 * Check if the boss is currently vulnerable to damage.
 * Boss is invulnerable during phase transitions.
 */
export function isBossVulnerable(state: BossAIState): boolean {
  return state.vulnerable && !state.transitioning && !state.defeated;
}

/**
 * Get the current phase's stat multipliers.
 */
export function getBossPhaseMultipliers(state: BossAIState): {
  speedMult: number;
  fireRateMult: number;
  damageMult: number;
  cooldownMult: number;
} {
  const phaseDef = getPhaseDef(state.phaseIndex);
  return {
    speedMult: phaseDef.speedMult,
    fireRateMult: phaseDef.fireRateMult,
    damageMult: phaseDef.damageMult,
    cooldownMult: phaseDef.cooldownMult,
  };
}

/**
 * Get the phase announcement text (for FlightScene to display).
 * Returns non-null only during phase transition.
 */
export function getBossPhaseAnnouncement(state: BossAIState): string | null {
  if (!state.transitioning) return null;
  const phaseDef = getPhaseDef(state.phaseIndex);
  return phaseDef.announcement;
}

/**
 * Get the current attack warning text (for FlightScene HUD).
 */
export function getBossWarningText(state: BossAIState): string | null {
  if (state.telegraphing) {
    return `${state.telegraphing.warningIcon} ${state.telegraphing.warningText}`;
  }
  if (state.activeAttack) {
    return `${state.activeAttack.warningIcon} ${state.activeAttack.displayName}`;
  }
  return null;
}

/**
 * Check if any boss attack is currently dealing damage.
 * Used by FlightScene to apply damage at the right time.
 */
export function isBossAttackActive(state: BossAIState): boolean {
  return state.activeAttack !== null;
}

/**
 * Get the active attack definition.
 */
export function getActiveBossAttack(state: BossAIState): BossAttackDef | null {
  return state.activeAttack;
}

/**
 * Check if a point is within the boss's active attack area.
 * Used by FlightScene for damage collision.
 */
export function isPointInBossAttackArea(
  state: BossAIState,
  point: { x: number; z: number },
  bossPos: { x: number; z: number },
): boolean {
  if (!state.activeAttack) return false;
  const attack = state.activeAttack;

  switch (attack.id) {
    case 'shockwave': {
      const dist = Math.hypot(point.x - bossPos.x, point.z - bossPos.z);
      // Damage in a ring: between shockwaveRadius - 2 and shockwaveRadius
      return dist <= state.shockwaveRadius && dist >= state.shockwaveRadius - 2;
    }
    case 'charge':
    case 'ram': {
      if (!state.chargeTarget) return false;
      const dist = Math.hypot(point.x - bossPos.x, point.z - bossPos.z);
      return dist <= attack.radius + 1;
    }
    case 'beam_sweep': {
      // Beam: check if point is within beam angle and range
      const dx = point.x - bossPos.x;
      const dz = point.z - bossPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 20 || dist < 1) return false;
      const angle = Math.atan2(dx, dz);
      const angleDiff = normalizeAngle(angle - state.beamSweepAngle);
      return Math.abs(angleDiff) < 0.3; // ~17 degree beam width
    }
    case 'barrage':
    case 'final_barrage': {
      const hasStrikeZones = state.telegraphs.some((telegraph) => telegraph.attackId === attack.id);
      if (hasStrikeZones) return pointInTelegraphedZone(state.telegraphs, attack.id, point);
      const dist = Math.hypot(point.x - bossPos.x, point.z - bossPos.z);
      return dist <= attack.radius + 3;
    }
    case 'mine_field': {
      return pointInTelegraphedZone(state.telegraphs, attack.id, point);
    }
    case 'missile_sweep': {
      if (pointInTelegraphedZone(state.telegraphs, attack.id, point)) return true;
      const dist = Math.hypot(point.x - bossPos.x, point.z - bossPos.z);
      return dist <= attack.radius + 2;
    }
    default:
      return false;
  }
}

/**
 * Normalize angle to [-PI, PI].
 */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/**
 * Check if a boss wave number is a boss wave.
 */
export function isBossWave(waveNumber: number): boolean {
  return waveNumber % 5 === 0 && waveNumber > 0;
}

/**
 * Get the boss name for display.
 */
export function getBossName(waveNumber: number): string {
  if (waveNumber <= 5) return 'Frigate Overlord';
  if (waveNumber <= 15) return 'Heavy Cruiser';
  if (waveNumber <= 25) return 'Battlecruiser';
  return 'Dreadnought';
}

/**
 * Scale boss HP by wave number.
 * Boss at wave 5 gets 2x normal, scaling up from there.
 */
export function getBossHpMultiplier(waveNumber: number): number {
  const bossTier = Math.floor(waveNumber / 5);
  return 2.5 + bossTier * 0.5; // 3.0 at wave 5, 3.5 at wave 10, etc.
}