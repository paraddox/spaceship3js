import type { AbilityRuntime, AbilityId } from './simulation';

// ── Tactical AI Stance System ────────────────────────────────────
//
// Each enemy evaluates its situation and adopts one of four stances.
// Stance determines movement behavior, firing aggressiveness, and
// ability usage. The stance is recomputed every frame based on
// real-time conditions (HP ratio, shield status, module losses).
//
// This replaces the previous simple "drift to preferred range" AI
// with a dynamic, context-aware behavior system.

export type EnemyStance = 'aggressive' | 'balanced' | 'cautious' | 'retreating';

export interface TacticalContext {
  ownHpRatio: number;           // 0..1 current HP as fraction of max
  ownShieldRatio: number;       // 0..1 current shield as fraction of max
  ownShieldMax: number;         // >0 if ship has shields
  moduleLossRatio: number;      // 0..1 fraction of modules destroyed
  distanceToTarget: number;     // current distance to primary target
  preferredRange: number;       // weapon sweet spot
  hasMissiles: boolean;         // can fight at long range
  hasBeam: boolean;             // needs to be close
  allyCount: number;            // nearby allies still alive
  engineIntact: boolean;        // still has engine modules
  targetHpRatio: number;        // target's health (for aggression)
  weaponCount: number;          // surviving weapon modules
}

export interface TacticalDecision {
  stance: EnemyStance;
  desiredDistance: number;       // how far the enemy wants to be from target
  lateralBias: number;          // -1..1, direction to strafe
  fireUrgency: number;          // 0..1, how aggressively to fire
  abilityToUse: AbilityId | null;
}

/**
 * Determine the optimal stance for an enemy given its current situation.
 */
export function evaluateStance(ctx: TacticalContext): EnemyStance {
  const { ownHpRatio, ownShieldRatio, ownShieldMax, moduleLossRatio, distanceToTarget, preferredRange, hasMissiles, hasBeam, allyCount, engineIntact, targetHpRatio, weaponCount } = ctx;

  // No weapons left → flee
  if (weaponCount === 0) return 'retreating';

  // Critical HP with no shields → retreat to survive
  if (ownHpRatio < 0.15 && (ownShieldMax === 0 || ownShieldRatio < 0.1)) {
    return 'retreating';
  }

  // Engine destroyed → can't maneuver, hold ground (balanced at current range)
  if (!engineIntact) return 'balanced';

  // Heavy damage → cautious kiting
  if (ownHpRatio < 0.35) {
    return 'cautious';
  }

  // Significant module losses → cautious
  if (moduleLossRatio > 0.4) {
    return 'cautious';
  }

  // Shield just dropped and we're taking fire → cautious temporarily
  if (ownShieldMax > 0 && ownShieldRatio < 0.15 && ownHpRatio < 0.6) {
    return 'cautious';
  }

  // outnumbering the player and healthy → aggressive
  if (allyCount >= 2 && ownHpRatio > 0.7 && targetHpRatio < 0.5) {
    return 'aggressive';
  }

  // Beam weapons need to close → aggressive when far out
  if (hasBeam && distanceToTarget > preferredRange * 1.3) {
    return 'aggressive';
  }

  // Healthy and at range → balanced (default)
  if (ownHpRatio > 0.5) {
    return 'balanced';
  }

  // Damaged but not critical → cautious
  return 'cautious';
}

/**
 * Compute tactical decision from stance and context.
 */
export function computeTacticalDecision(
  stance: EnemyStance,
  ctx: TacticalContext,
  flankSeed: number,   // deterministic per-enemy, spreads approach vectors
): TacticalDecision {
  const { preferredRange, distanceToTarget, ownHpRatio, ownShieldRatio, hasMissiles } = ctx;

  let desiredDistance: number;
  let lateralBias: number;
  let fireUrgency: number;

  switch (stance) {
    case 'aggressive':
      desiredDistance = preferredRange * 0.6;         // close in
      lateralBias = flankSeed * 0.5;                   // slight spread
      fireUrgency = 1.0;
      break;

    case 'balanced':
      desiredDistance = preferredRange;
      lateralBias = flankSeed;                         // full flank spread
      fireUrgency = 0.8;
      break;

    case 'cautious':
      // Kite at longer range; missile users can kite further
      desiredDistance = hasMissiles
        ? preferredRange * 1.5
        : preferredRange * 1.2;
      lateralBias = -flankSeed * 0.8;                  // move away from center
      fireUrgency = ownHpRatio < 0.25 ? 0.4 : 0.6;
      break;

    case 'retreating':
      desiredDistance = 50;                             // max distance
      lateralBias = 0;
      fireUrgency = 0.15;                              // sporadic fire while fleeing
      break;
  }

  const abilityToUse = evaluateAbilityUse(stance, ctx);

  return { stance, desiredDistance, lateralBias, fireUrgency, abilityToUse };
}

/**
 * Decide if the enemy should use an ability this frame.
 */
function evaluateAbilityUse(stance: EnemyStance, ctx: TacticalContext): AbilityId | null {
  // This is called every frame but actual ability activation is gated
  // by cooldowns in the ability runtime system, so returning a suggestion
  // every frame is fine — only one will actually trigger.
  switch (stance) {
    case 'aggressive':
      return 'afterburner';   // rush in
    case 'balanced':
      return ctx.ownShieldMax > 0 && ctx.ownShieldRatio < 0.3
        ? 'shield_boost'     // recharge shields when low
        : null;
    case 'cautious':
      if (ctx.moduleLossRatio > 0.2) return 'emergency_repair'; // repair damaged modules
      return ctx.ownShieldMax > 0
        ? 'shield_boost'     // defensive
        : 'afterburner';     // speed retreat
    case 'retreating':
      if (ctx.moduleLossRatio > 0.3) return 'emergency_repair'; // repair before fleeing
      return 'afterburner';  // flee faster
    default:
      return null;
  }
}

/**
 * Compute a flank seed for an enemy — a deterministic value in [-1, 1]
 * that spreads enemies across different approach vectors.
 *
 * Uses the enemy's index among living allies so the formation
 * naturally adjusts as enemies die.
 */
export function computeFlankSeed(enemyIndex: number, totalAllies: number): number {
  if (totalAllies <= 1) return 0.3; // single enemy: slight offset

  // Distribute evenly from -1 to 1
  const t = enemyIndex / Math.max(1, totalAllies - 1); // 0..1
  return -1 + 2 * t; // -1..1
}
