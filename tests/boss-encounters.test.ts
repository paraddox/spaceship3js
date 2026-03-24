import { describe, it, expect } from 'vitest';
import {
  createBossAI,
  updateBossAI,
  isBossVulnerable,
  isBossWave,
  isBossAttackActive,
  getActiveBossAttack,
  getBossPhaseMultipliers,
  getBossPhaseAnnouncement,
  getBossWarningText,
  getBossHpMultiplier,
  getBossName,
  getPhaseDef,
  isPointInBossAttackArea,
  shouldTransitionPhase,
} from '../src/game/boss-encounters';
import type { BossAIState } from '../src/game/boss-encounters';

// ── Helper ──────────────────────────────────────────────────

function makeContext(overrides: Partial<{
  bossHp: number;
  bossMaxHp: number;
  bossPos: { x: number; z: number };
  playerPos: { x: number; z: number };
}> = {}) {
  return {
    bossHp: overrides.bossHp ?? 100,
    bossMaxHp: overrides.bossMaxHp ?? 100,
    bossPos: overrides.bossPos ?? { x: 0, z: -10 },
    playerPos: overrides.playerPos ?? { x: 0, z: 8 },
  };
}

// ── Creation ────────────────────────────────────────────────

describe('createBossAI', () => {
  it('creates initial state in assault phase', () => {
    const state = createBossAI(5);
    expect(state.phase).toBe('assault');
    expect(state.phaseIndex).toBe(0);
    expect(state.vulnerable).toBe(true);
    expect(state.defeated).toBe(false);
    expect(state.transitioning).toBe(false);
    expect(state.telegraphing).toBeNull();
    expect(state.activeAttack).toBeNull();
    expect(state.telegraphs).toEqual([]);
  });

  it('has initial grace period cooldown', () => {
    const state = createBossAI(5);
    expect(state.attackCooldown).toBe(2.0);
  });

  it('seed varies by wave number', () => {
    const s1 = createBossAI(5);
    const s2 = createBossAI(10);
    expect(s1.seed).not.toBe(s2.seed);
  });
});

// ── Wave Detection ─────────────────────────────────────────

describe('isBossWave', () => {
  it('returns true for multiples of 5', () => {
    expect(isBossWave(5)).toBe(true);
    expect(isBossWave(10)).toBe(true);
    expect(isBossWave(15)).toBe(true);
    expect(isBossWave(20)).toBe(true);
  });

  it('returns false for non-multiples of 5', () => {
    expect(isBossWave(0)).toBe(false);
    expect(isBossWave(1)).toBe(false);
    expect(isBossWave(7)).toBe(false);
    expect(isBossWave(13)).toBe(false);
  });
});

// ── Phase Transitions ──────────────────────────────────────

describe('shouldTransitionPhase', () => {
  it('triggers at 55% HP (phase 2)', () => {
    expect(shouldTransitionPhase(0, 0.54)).toBe(true);
    expect(shouldTransitionPhase(0, 0.56)).toBe(false);
  });

  it('triggers at 25% HP (phase 3)', () => {
    expect(shouldTransitionPhase(1, 0.24)).toBe(true);
    expect(shouldTransitionPhase(1, 0.26)).toBe(false);
  });

  it('does not downgrade when healing', () => {
    expect(shouldTransitionPhase(2, 0.5)).toBe(false);
  });

  it('does not trigger from phase 0 at 100%', () => {
    expect(shouldTransitionPhase(0, 1.0)).toBe(false);
  });
});

describe('updateBossAI phase transitions', () => {
  it('transitions to phase 2 when HP drops below 55%', () => {
    const state = createBossAI(5);
    const ctx = makeContext({ bossHp: 50, bossMaxHp: 100 });
    const updated = updateBossAI(state, 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(updated.phaseIndex).toBe(1);
    expect(updated.phase).toBe('cannonade');
    expect(updated.transitioning).toBe(true);
    expect(updated.vulnerable).toBe(false);
  });

  it('transitions to phase 3 when HP drops below 25%', () => {
    let state = createBossAI(5);
    // First transition to phase 2
    const ctx2 = makeContext({ bossHp: 50, bossMaxHp: 100 });
    state = updateBossAI(state, 0.1, ctx2.bossHp, ctx2.bossMaxHp, ctx2.bossPos, ctx2.playerPos);
    expect(state.phaseIndex).toBe(1);

    // Then immediately to phase 3 (HP already below 25%)
    const ctx3 = makeContext({ bossHp: 20, bossMaxHp: 100 });
    state = updateBossAI(state, 0.1, ctx3.bossHp, ctx3.bossMaxHp, ctx3.bossPos, ctx3.playerPos);
    expect(state.phaseIndex).toBe(2);
    expect(state.phase).toBe('desperation');
  });

  it('ends transition after timer expires', () => {
    let state = createBossAI(5);
    const ctx = makeContext({ bossHp: 50, bossMaxHp: 100 });
    state = updateBossAI(state, 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(state.transitioning).toBe(true);
    expect(state.transitionTimer).toBeGreaterThan(0);

    // Tick past the transition duration
    const transitionDuration = getPhaseDef(1).transitionDuration;
    state = updateBossAI(state, transitionDuration + 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(state.transitioning).toBe(false);
    expect(state.vulnerable).toBe(true);
  });
});

// ── Vulnerability ──────────────────────────────────────────

describe('isBossVulnerable', () => {
  it('returns true for normal idle state', () => {
    const state = createBossAI(5);
    expect(isBossVulnerable(state)).toBe(true);
  });

  it('returns false during phase transition', () => {
    let state = createBossAI(5);
    const ctx = makeContext({ bossHp: 50, bossMaxHp: 100 });
    state = updateBossAI(state, 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(isBossVulnerable(state)).toBe(false);
  });

  it('returns false when defeated', () => {
    const state: BossAIState = { ...createBossAI(5), defeated: true };
    expect(isBossVulnerable(state)).toBe(false);
  });
});

// ── Attack Lifecycle ───────────────────────────────────────

describe('attack lifecycle', () => {
  it('starts telegraphing after cooldown expires', () => {
    let state: BossAIState = {
      ...createBossAI(5),
      attackCooldown: 0, // no cooldown
    };
    const ctx = makeContext();
    state = updateBossAI(state, 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    // Should start telegraphing an attack
    expect(state.telegraphing).not.toBeNull();
    expect(state.telegraphTimer).toBeGreaterThan(0);
  });

  it('transitions from telegraph to active attack', () => {
    let state = createBossAI(5);
    const ctx = makeContext();

    // Skip to telegraphing
    state = { ...state, attackCooldown: 0 };
    state = updateBossAI(state, 0.01, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(state.telegraphing).not.toBeNull();
    const telegraphDuration = state.telegraphing!.telegraphDuration;

    // Tick past telegraph duration
    state = updateBossAI(state, telegraphDuration + 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(state.telegraphing).toBeNull();
    expect(state.activeAttack).not.toBeNull();
    expect(state.activeAttackTimer).toBeGreaterThan(0);
  });

  it('preserves mine telegraphs when mine field becomes active', () => {
    const state: BossAIState = {
      ...createBossAI(5),
      telegraphing: {
        id: 'mine_field',
        displayName: 'Mine Deployment',
        telegraphDuration: 1,
        activeDuration: 2.5,
        cooldown: 9,
        damage: 6,
        radius: 2,
        tracksPlayer: false,
        warningText: 'MINES DEPLOYED',
        warningIcon: '💣',
      },
      telegraphTimer: 0.05,
      telegraphs: [
        {
          attackId: 'mine_field',
          position: { x: 8, z: -2 },
          timeRemaining: 0.05,
          duration: 1,
          radius: 2,
          tracksPlayer: false,
        },
        {
          attackId: 'mine_field',
          position: { x: -6, z: 4 },
          timeRemaining: 0.05,
          duration: 1,
          radius: 2,
          tracksPlayer: false,
        },
      ],
    };
    const ctx = makeContext();
    const updated = updateBossAI(state, 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(updated.activeAttack?.id).toBe('mine_field');
    expect(updated.telegraphs).toHaveLength(2);
  });

  it('keeps charge targets committed once the dash starts', () => {
    const originalTarget = { x: 10, z: -6 };
    const ctx = makeContext({ bossPos: { x: 0, z: 0 }, playerPos: { x: 4, z: 7 } });

    for (const id of ['charge', 'ram'] as const) {
      const updated = updateBossAI(
        {
          ...createBossAI(5),
          activeAttack: {
            id,
            displayName: id,
            telegraphDuration: 0.7,
            activeDuration: 1.2,
            cooldown: 7,
            damage: 20,
            radius: 3,
            tracksPlayer: true,
            warningText: '',
            warningIcon: '',
          },
          activeAttackTimer: 1.2,
          chargeTarget: originalTarget,
          chargeProgress: 0.2,
        },
        0.2,
        ctx.bossHp,
        ctx.bossMaxHp,
        ctx.bossPos,
        ctx.playerPos,
      );

      expect(updated.chargeTarget).toEqual(originalTarget);
      expect(updated.chargeProgress).toBeGreaterThan(0.2);
    }
  });

  it('transitions from active to cooldown', () => {
    let state = createBossAI(5);
    const ctx = makeContext();

    // Fast-forward to active attack
    state = { ...state, attackCooldown: 0 };
    state = updateBossAI(state, 0.01, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    const telegraphDuration = state.telegraphing!.telegraphDuration;
    state = updateBossAI(state, telegraphDuration + 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(state.activeAttack).not.toBeNull();

    const activeDuration = state.activeAttack!.activeDuration;
    // Tick past active duration
    state = updateBossAI(state, activeDuration + 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(state.activeAttack).toBeNull();
    expect(state.attackCooldown).toBeGreaterThan(0);
    expect(state.attacksInPhase).toBeGreaterThan(0);
  });

  it('does not attack when defeated', () => {
    const state: BossAIState = {
      ...createBossAI(5),
      attackCooldown: 0,
      defeated: true,
    };
    const ctx = makeContext();
    const updated = updateBossAI(state, 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    expect(updated.telegraphing).toBeNull();
    expect(updated.activeAttack).toBeNull();
  });
});

// ── Query Functions ────────────────────────────────────────

describe('getBossPhaseMultipliers', () => {
  it('phase 1 has baseline multipliers', () => {
    const state = createBossAI(5);
    const mults = getBossPhaseMultipliers(state);
    expect(mults.speedMult).toBe(1.0);
    expect(mults.fireRateMult).toBe(1.0);
    expect(mults.damageMult).toBe(1.0);
  });

  it('phase 3 has highest multipliers', () => {
    const state: BossAIState = { ...createBossAI(5), phaseIndex: 2 };
    const mults = getBossPhaseMultipliers(state);
    expect(mults.speedMult).toBe(1.35);
    expect(mults.damageMult).toBe(1.5);
    expect(mults.fireRateMult).toBe(1.5);
  });
});

describe('getBossPhaseAnnouncement', () => {
  it('returns null when not transitioning', () => {
    const state = createBossAI(5);
    expect(getBossPhaseAnnouncement(state)).toBeNull();
  });

  it('returns announcement text when transitioning', () => {
    let state = createBossAI(5);
    const ctx = makeContext({ bossHp: 50, bossMaxHp: 100 });
    state = updateBossAI(state, 0.1, ctx.bossHp, ctx.bossMaxHp, ctx.bossPos, ctx.playerPos);
    const ann = getBossPhaseAnnouncement(state);
    expect(ann).not.toBeNull();
    expect(ann!.length).toBeGreaterThan(0);
  });
});

describe('getBossWarningText', () => {
  it('returns null when idle', () => {
    const state = createBossAI(5);
    expect(getBossWarningText(state)).toBeNull();
  });

  it('returns warning during telegraph', () => {
    const state: BossAIState = {
      ...createBossAI(5),
      telegraphing: {
        id: 'barrage',
        displayName: 'Test',
        telegraphDuration: 1,
        activeDuration: 1,
        cooldown: 1,
        damage: 1,
        radius: 1,
        tracksPlayer: true,
        warningText: 'TEST WARNING',
        warningIcon: '🔴',
      },
      telegraphTimer: 0.5,
    };
    const warning = getBossWarningText(state);
    expect(warning).toContain('TEST WARNING');
  });
});

// ── Boss Naming & Scaling ──────────────────────────────────

describe('getBossName', () => {
  it('returns Frigate Overlord for wave 5', () => {
    expect(getBossName(5)).toBe('Frigate Overlord');
  });

  it('returns Heavy Cruiser for wave 10', () => {
    expect(getBossName(10)).toBe('Heavy Cruiser');
  });

  it('returns Battlecruiser for wave 20', () => {
    expect(getBossName(20)).toBe('Battlecruiser');
  });

  it('returns Dreadnought for wave 30+', () => {
    expect(getBossName(30)).toBe('Dreadnought');
  });
});

describe('getBossHpMultiplier', () => {
  it('wave 5 gets 3.0x HP', () => {
    expect(getBossHpMultiplier(5)).toBe(3.0);
  });

  it('wave 10 gets higher HP than wave 5', () => {
    expect(getBossHpMultiplier(10)).toBeGreaterThan(getBossHpMultiplier(5));
  });

  it('scales linearly per boss tier', () => {
    const m5 = getBossHpMultiplier(5);
    const m10 = getBossHpMultiplier(10);
    const m15 = getBossHpMultiplier(15);
    expect(m10).toBeGreaterThan(m5);
    expect(m15).toBeGreaterThan(m10);
  });
});

// ── Attack Collision ───────────────────────────────────────

describe('isPointInBossAttackArea', () => {
  it('returns false when no active attack', () => {
    const state = createBossAI(5);
    expect(isPointInBossAttackArea(state, { x: 5, z: 5 }, { x: 0, z: 0 })).toBe(false);
  });

  it('shockwave hits in ring area', () => {
    const state: BossAIState = {
      ...createBossAI(5),
      activeAttack: {
        id: 'shockwave',
        displayName: 'Shockwave',
        telegraphDuration: 0.6,
        activeDuration: 0.8,
        cooldown: 5,
        damage: 10,
        radius: 12,
        tracksPlayer: false,
        warningText: '',
        warningIcon: '',
      },
      activeAttackTimer: 0.5,
      shockwaveRadius: 6,
      shockwaveMaxRadius: 12,
    };
    // Point at distance 6 (within ring) should be hit
    expect(isPointInBossAttackArea(state, { x: 6, z: 0 }, { x: 0, z: 0 })).toBe(true);
    // Point at distance 0 (inside ring, not on it) should not be hit
    expect(isPointInBossAttackArea(state, { x: 0, z: 0 }, { x: 0, z: 0 })).toBe(false);
  });

  it('charge hits close to boss', () => {
    const state: BossAIState = {
      ...createBossAI(5),
      activeAttack: {
        id: 'charge',
        displayName: 'Charge',
        telegraphDuration: 0.7,
        activeDuration: 1.2,
        cooldown: 7,
        damage: 20,
        radius: 3,
        tracksPlayer: true,
        warningText: '',
        warningIcon: '',
      },
      activeAttackTimer: 0.5,
      chargeTarget: { x: 5, z: 5 },
      chargeProgress: 0.5,
    };
    // Close to boss should be hit
    expect(isPointInBossAttackArea(state, { x: 2, z: 2 }, { x: 0, z: 0 })).toBe(true);
    // Far from boss should not be hit
    expect(isPointInBossAttackArea(state, { x: 15, z: 15 }, { x: 0, z: 0 })).toBe(false);
  });

  it('barrage damage follows the telegraphed strike zone', () => {
    const state: BossAIState = {
      ...createBossAI(5),
      activeAttack: {
        id: 'barrage',
        displayName: 'Punisher Barrage',
        telegraphDuration: 0.8,
        activeDuration: 2,
        cooldown: 4,
        damage: 8,
        radius: 4,
        tracksPlayer: true,
        warningText: '',
        warningIcon: '',
      },
      activeAttackTimer: 1.2,
      telegraphs: [
        {
          attackId: 'barrage',
          position: { x: 10, z: 0 },
          timeRemaining: 1,
          duration: 1,
          radius: 4,
          tracksPlayer: false,
        },
      ],
    };
    expect(isPointInBossAttackArea(state, { x: 10, z: 1 }, { x: 0, z: 0 })).toBe(true);
    expect(isPointInBossAttackArea(state, { x: 1, z: 1 }, { x: 0, z: 0 })).toBe(false);
  });

  it('mine field only hits inside active mine circles', () => {
    const state: BossAIState = {
      ...createBossAI(5),
      activeAttack: {
        id: 'mine_field',
        displayName: 'Mine Deployment',
        telegraphDuration: 1,
        activeDuration: 2.5,
        cooldown: 9,
        damage: 6,
        radius: 2,
        tracksPlayer: false,
        warningText: '',
        warningIcon: '',
      },
      activeAttackTimer: 1.4,
      telegraphs: [
        {
          attackId: 'mine_field',
          position: { x: -4, z: 3 },
          timeRemaining: 1,
          duration: 1,
          radius: 2,
          tracksPlayer: false,
        },
        {
          attackId: 'mine_field',
          position: { x: 7, z: -2 },
          timeRemaining: 1,
          duration: 1,
          radius: 2,
          tracksPlayer: false,
        },
      ],
    };
    expect(isPointInBossAttackArea(state, { x: -4, z: 2.5 }, { x: 0, z: 0 })).toBe(true);
    expect(isPointInBossAttackArea(state, { x: 0, z: 0 }, { x: 0, z: 0 })).toBe(false);
  });
});

// ── Phase Definitions ──────────────────────────────────────

describe('getPhaseDef', () => {
  it('returns correct phase for each index', () => {
    expect(getPhaseDef(0).id).toBe('assault');
    expect(getPhaseDef(1).id).toBe('cannonade');
    expect(getPhaseDef(2).id).toBe('desperation');
  });

  it('clamps to last phase for out-of-range index', () => {
    expect(getPhaseDef(5).id).toBe('desperation');
  });

  it('phase 1 has 3 attacks', () => {
    expect(getPhaseDef(0).attacks.length).toBe(3);
  });

  it('phase 3 has 5 attacks including ram and final_barrage', () => {
    const attacks = getPhaseDef(2).attacks.map(a => a.id);
    expect(attacks).toContain('ram');
    expect(attacks).toContain('final_barrage');
    expect(attacks.length).toBe(5);
  });
});
