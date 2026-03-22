import { describe, it, expect } from 'vitest';
import {
  evaluateStance,
  computeTacticalDecision,
  computeFlankSeed,
  type TacticalContext,
} from '../src/game/tactical-ai';

function makeCtx(overrides: Partial<TacticalContext> = {}): TacticalContext {
  return {
    ownHpRatio: 1,
    ownShieldRatio: 1,
    ownShieldMax: 50,
    moduleLossRatio: 0,
    distanceToTarget: 10,
    preferredRange: 10,
    hasMissiles: false,
    hasBeam: false,
    allyCount: 1,
    engineIntact: true,
    targetHpRatio: 1,
    weaponCount: 2,
    ...overrides,
  };
}

describe('evaluateStance', () => {
  it('returns aggressive when healthy, with allies, and target is weakened', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.8,
      allyCount: 2,
      targetHpRatio: 0.4,
    }));
    expect(stance).toBe('aggressive');
  });

  it('returns balanced when healthy and at range', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.7,
      distanceToTarget: 10,
      preferredRange: 10,
    }));
    expect(stance).toBe('balanced');
  });

  it('returns cautious when HP is low', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.3,
    }));
    expect(stance).toBe('cautious');
  });

  it('returns cautious when module loss is high', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.6,
      moduleLossRatio: 0.5,
    }));
    expect(stance).toBe('cautious');
  });

  it('returns retreating when HP is critical with no shields', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.1,
      ownShieldMax: 0,
    }));
    expect(stance).toBe('retreating');
  });

  it('returns retreating when HP is critical and shields depleted', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.12,
      ownShieldRatio: 0.05,
      ownShieldMax: 50,
    }));
    expect(stance).toBe('retreating');
  });

  it('returns retreating when no weapons remain', () => {
    const stance = evaluateStance(makeCtx({
      weaponCount: 0,
      ownHpRatio: 0.5,
    }));
    expect(stance).toBe('retreating');
  });

  it('returns balanced when engine destroyed (cannot maneuver)', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.2,
      engineIntact: false,
    }));
    expect(stance).toBe('balanced');
  });

  it('returns aggressive for beam users far from target', () => {
    const stance = evaluateStance(makeCtx({
      hasBeam: true,
      distanceToTarget: 15,
      preferredRange: 8,
      ownHpRatio: 0.7,
    }));
    expect(stance).toBe('aggressive');
  });

  it('returns cautious when shields just dropped with moderate damage', () => {
    const stance = evaluateStance(makeCtx({
      ownHpRatio: 0.5,
      ownShieldRatio: 0.1,
      ownShieldMax: 50,
    }));
    expect(stance).toBe('cautious');
  });
});

describe('computeFlankSeed', () => {
  it('returns 0.3 for a single enemy', () => {
    expect(computeFlankSeed(0, 1)).toBeCloseTo(0.3);
  });

  it('spreads enemies evenly from -1 to 1', () => {
    const seeds = [
      computeFlankSeed(0, 3),
      computeFlankSeed(1, 3),
      computeFlankSeed(2, 3),
    ];
    expect(seeds[0]).toBeCloseTo(-1);
    expect(seeds[1]).toBeCloseTo(0);
    expect(seeds[2]).toBeCloseTo(1);
  });

  it('works for 2 enemies', () => {
    expect(computeFlankSeed(0, 2)).toBeCloseTo(-1);
    expect(computeFlankSeed(1, 2)).toBeCloseTo(1);
  });
});

describe('computeTacticalDecision', () => {
  it('aggressive stance desires close range', () => {
    const decision = computeTacticalDecision('aggressive', makeCtx(), 0.3);
    expect(decision.stance).toBe('aggressive');
    expect(decision.desiredDistance).toBeLessThan(makeCtx().preferredRange);
    expect(decision.fireUrgency).toBe(1.0);
  });

  it('balanced stance matches preferred range', () => {
    const ctx = makeCtx({ preferredRange: 10 });
    const decision = computeTacticalDecision('balanced', ctx, 0.5);
    expect(decision.stance).toBe('balanced');
    expect(decision.desiredDistance).toBe(10);
    expect(decision.fireUrgency).toBe(0.8);
  });

  it('cautious stance desires longer range', () => {
    const ctx = makeCtx({ preferredRange: 10, hasMissiles: true });
    const decision = computeTacticalDecision('cautious', ctx, -0.5);
    expect(decision.stance).toBe('cautious');
    expect(decision.desiredDistance).toBeGreaterThan(ctx.preferredRange);
    expect(decision.fireUrgency).toBeLessThan(0.8);
  });

  it('retreating stance desires max distance and low fire urgency', () => {
    const decision = computeTacticalDecision('retreating', makeCtx(), 0);
    expect(decision.stance).toBe('retreating');
    expect(decision.desiredDistance).toBe(50);
    expect(decision.fireUrgency).toBe(0.15);
  });

  it('aggressive enemies use afterburner', () => {
    const decision = computeTacticalDecision('aggressive', makeCtx(), 0);
    expect(decision.abilityToUse).toBe('afterburner');
  });

  it('cautious enemies with module damage use repair', () => {
    const ctx = makeCtx({ moduleLossRatio: 0.3 });
    const decision = computeTacticalDecision('cautious', ctx, 0);
    expect(decision.abilityToUse).toBe('emergency_repair');
  });

  it('balanced enemies with low shields use shield boost', () => {
    const ctx = makeCtx({ ownShieldMax: 50, ownShieldRatio: 0.2 });
    const decision = computeTacticalDecision('balanced', ctx, 0);
    expect(decision.abilityToUse).toBe('shield_boost');
  });
});
