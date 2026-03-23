// ── Critical Events — Crisis Protocol ─────────────────────────
//
// Between-wave crisis scenarios in endless mode. Every ~6 waves,
// instead of a normal shop phase, the player encounters a dangerous
// time-pressured scenario offering a dramatically powerful but
// uniquely compromised reward.
//
// Each event has two mutually-exclusive choices. Both are double-edged
// transforms — they redirect how existing mechanics work, creating
// emergent synergies with other systems (mutators, mutagen, overdrive,
// combo, dash, etc.).
//
// Pure logic — no Three.js imports.

// ── Types ──────────────────────────────────────────────────────

/** IDs of all active critical event effects. Used to check state in game loop. */
export type CrisisEffectId =
  | 'meltdown_protocol'
  | 'containment_override'
  | 'time_echo'
  | 'phase_shift'
  | 'adaptive_mutation'
  | 'gene_trade'
  | 'neural_link'
  | 'symbiote_bond';

export interface CrisisEventDef {
  id: string;
  /** Short dramatic name shown in the UI header */
  name: string;
  /** Flavor text setting the scene */
  description: string;
  /** Which waves this event can appear at (every EVENT_INTERVAL waves) */
  waveMin: number;
  /** Icon for the event card */
  icon: string;
  /** Two mutually exclusive choices */
  choices: CrisisChoice[];
}

export interface CrisisChoice {
  id: CrisisEffectId;
  /** Short label for the choice button */
  name: string;
  /** Description of what this choice does — the power AND the cost */
  description: string;
  /** Flavor text — the narrative wrapper */
  flavor: string;
  /** Icon for the choice card */
  icon: string;
  /** Color for the card border */
  color: string;
}

export interface CrisisState {
  /** The event currently being presented (null if none) */
  pendingEvent: CrisisEventDef | null;
  /** All effects the player has chosen this run */
  activeEffects: CrisisEffectId[];
  /** Wave numbers at which crisis events were resolved */
  resolvedWaves: number[];
}

// ── Constants ──────────────────────────────────────────────────

/** A crisis event triggers every N waves (starting at wave EVENT_WAVE_MIN) */
export const EVENT_INTERVAL = 6;
export const EVENT_WAVE_MIN = 6;
export const MAX_EFFECTS = 4;

// ── Event Definitions ──────────────────────────────────────────

const CRISIS_EVENTS: CrisisEventDef[] = [
  {
    id: 'anomalous_reactor',
    name: 'Anomalous Reactor Core',
    description: 'A drifting warship\'s reactor core pulses with unstable energy. Its containment field is failing — you can siphon the power, but at a cost.',
    waveMin: 6,
    icon: '☢️',
    choices: [
      {
        id: 'meltdown_protocol',
        name: 'Meltdown Protocol',
        description: 'Overcharge deals 4× damage for 6s but costs 12% HP on activation. Overdrive charges 60% faster.',
        flavor: 'Ride the lightning. Every activation is a gamble.',
        icon: '💥',
        color: '#ef4444',
      },
      {
        id: 'containment_override',
        name: 'Containment Override',
        description: 'All ability cooldowns reduced by 30%. Activating any ability generates a 40 HP shield bubble.',
        flavor: 'Control the chaos. Turn every button press into a shield.',
        icon: '🛡️',
        color: '#60a5fa',
      },
    ],
  },
  {
    id: 'temporal_rift',
    name: 'Temporal Rift',
    description: 'A fracture in spacetime ripples across the arena. Chronal energy warps the fabric of reality — step through, but choose your distortion carefully.',
    waveMin: 6,
    icon: '⏳',
    choices: [
      {
        id: 'time_echo',
        name: 'Time Echo',
        description: 'Your dash spawns a ghost that fires your weapons for 3s. Dash cooldown increased by 40%.',
        flavor: 'Your past self fights alongside you — if you can wait between dashes.',
        icon: '👻',
        color: '#a78bfa',
      },
      {
        id: 'phase_shift',
        name: 'Phase Shift',
        description: 'All enemy projectiles move 35% slower. Your ship is 25% faster but takes 15% more damage.',
        flavor: 'Dance through a slowed world — but you\'re made of glass.',
        icon: '🌊',
        color: '#38bdf8',
      },
    ],
  },
  {
    id: 'distress_signal',
    name: 'Distress Signal',
    description: 'A crippled transport broadcasts a desperate plea. Its cargo hold contains something valuable — but boarding isn\'t free.',
    waveMin: 12,
    icon: '📡',
    choices: [
      {
        id: 'neural_link',
        name: 'Neural Link',
        description: 'Gain +40% damage and +30% fire rate for 8s after killing an elite. But enemies gain +1 random affix.',
        flavor: 'Feed on the strong. They\'ll grow stronger to match you.',
        icon: '🧠',
        color: '#f472b6',
      },
      {
        id: 'symbiote_bond',
        name: 'Symbiote Bond',
        description: 'Regenerate 3% max HP per second while combo is active. But combo timer decays 40% faster.',
        flavor: 'The fight sustains you — only while you\'re winning it.',
        icon: '🩸',
        color: '#34d399',
      },
    ],
  },
  {
    id: 'mutagen_spill',
    name: 'Mutagen Spill',
    description: 'Biohazard canisters rupture nearby, flooding the area with unstable mutagenic compounds. Exposure changes things.',
    waveMin: 12,
    icon: '🧬',
    choices: [
      {
        id: 'adaptive_mutation',
        name: 'Adaptive Mutation',
        description: 'Gain 50% bonus to all mutagen stat multipliers for this run. But you lose all current mutagen mutations permanently.',
        flavor: 'Burn the old growth to make way for the new.',
        icon: '⚗️',
        color: '#fbbf24',
      },
      {
        id: 'gene_trade',
        name: 'Gene Trade',
        description: 'All upgrade costs reduced by 40% for the rest of the run. But all future upgrades only grant 60% of their normal stats.',
        flavor: 'Cheap power — watered down, but you can afford more of it.',
        icon: '💰',
        color: '#fb923c',
      },
    ],
  },
];

// ── State Creation ─────────────────────────────────────────────

export function createCrisisState(): CrisisState {
  return {
    pendingEvent: null,
    activeEffects: [],
    resolvedWaves: [],
  };
}

// ── Event Selection ────────────────────────────────────────────

/** Check if a crisis event should trigger at this wave number. */
export function shouldTriggerCrisis(waveNumber: number, state: CrisisState): boolean {
  if (waveNumber < EVENT_WAVE_MIN) return false;
  if (state.resolvedWaves.includes(waveNumber)) return false;
  if (state.activeEffects.length >= MAX_EFFECTS) return false;
  return waveNumber % EVENT_INTERVAL === 0;
}

/** Select a random eligible event for the given wave. Returns null if no events available. */
export function selectCrisisEvent(waveNumber: number, state: CrisisState, rng: number): CrisisEventDef | null {
  const eligible = CRISIS_EVENTS.filter(
    (e) => waveNumber >= e.waveMin && !state.activeEffects.some((a) => e.choices.some((c) => c.id === a)),
  );
  if (eligible.length === 0) return null;

  // Weighted random selection
  const weights = eligible.map((e) => {
    let w = 1;
    if (e.waveMin >= 12) w = 0.7; // Later events are rarer
    return w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng * total;
  for (let i = 0; i < eligible.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

/** Prepare a crisis event for presentation. Returns updated state. */
export function prepareCrisisEvent(waveNumber: number, state: CrisisState, rng: number): CrisisState {
  const event = selectCrisisEvent(waveNumber, state, rng);
  return { ...state, pendingEvent: event };
}

// ── Choice Resolution ──────────────────────────────────────────

/** Resolve the player's choice. Returns updated state with the effect applied. */
export function resolveCrisisChoice(state: CrisisState, effectId: CrisisEffectId): CrisisState {
  if (!state.pendingEvent) return state;
  if (state.activeEffects.length >= MAX_EFFECTS) return state;
  return {
    ...state,
    pendingEvent: null,
    activeEffects: [...state.activeEffects, effectId],
    resolvedWaves: [...state.resolvedWaves, ...([] as number[])], // wave added by FlightScene
  };
}

/** Mark the current wave as resolved (called from FlightScene with actual wave number). */
export function markCrisisResolved(state: CrisisState, wave: number): CrisisState {
  return { ...state, resolvedWaves: [...state.resolvedWaves, wave] };
}

// ── Effect Query Functions ─────────────────────────────────────
// These are called from the game loop to apply active effects.
// All return sensible defaults when the effect is not active.

const hasEffect = (effects: CrisisEffectId[], id: CrisisEffectId): boolean => effects.includes(id);

/** Overcharge HP cost fraction (0 = no cost). Meltdown: 0.12 */
export function getOverchargeHpCost(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'meltdown_protocol') ? 0.12 : 0;
}

/** Overcharge damage multiplier. Meltdown: 4× base (so 2× extra over the normal 2×) */
export function getOverchargeDamageMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'meltdown_protocol') ? 2 : 1;
}

/** Overcharge duration bonus (seconds). Meltdown: +4s (total 6s instead of 2s) */
export function getOverchargeDurationBonus(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'meltdown_protocol') ? 4 : 0;
}

/** Overdrive charge rate multiplier. Meltdown: 1.6× */
export function getOverdriveChargeMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'meltdown_protocol') ? 1.6 : 1;
}

/** Ability cooldown reduction (additive fraction). Containment: 0.3 */
export function getAbilityCooldownReduction(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'containment_override') ? 0.3 : 0;
}

/** Shield bubble HP on ability activation. Containment: 40 */
export function getAbilityShieldBubble(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'containment_override') ? 40 : 0;
}

/** Dash cooldown multiplier. Time Echo: 1.4× (slower dash) */
export function getDashCooldownMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'time_echo') ? 1.4 : 1;
}

/** Dash ghost duration (seconds). Time Echo: 3 */
export function getDashGhostDuration(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'time_echo') ? 3 : 0;
}

/** Enemy projectile speed multiplier. Phase Shift: 0.65 */
export function getEnemyProjectileSpeedMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'phase_shift') ? 0.65 : 1;
}

/** Player thrust multiplier. Phase Shift: 1.25 */
export function getPlayerThrustMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'phase_shift') ? 1.25 : 1;
}

/** Player damage taken multiplier. Phase Shift: 1.15 */
export function getDamageTakenMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'phase_shift') ? 1.15 : 1;
}

/** Buff damage multiplier after elite kill (duration seconds). Neural Link: 8 */
export function getEliteKillBuffDuration(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'neural_link') ? 8 : 0;
}

/** Buff damage multiplier after elite kill. Neural Link: 1.4 */
export function getEliteKillDamageBuff(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'neural_link') ? 1.4 : 1;
}

/** Buff fire rate multiplier after elite kill. Neural Link: 1.3 */
export function getEliteKillFireRateBuff(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'neural_link') ? 1.3 : 1;
}

/** Extra affix count on enemies. Neural Link: 1 */
export function getExtraEnemyAffixes(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'neural_link') ? 1 : 0;
}

/** HP regen per second while combo is active (fraction of max HP). Symbiote: 0.03 */
export function getComboHpRegen(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'symbiote_bond') ? 0.03 : 0;
}

/** Combo timer decay multiplier. Symbiote: 1.4 (faster decay) */
export function getComboTimerDecayMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'symbiote_bond') ? 1.4 : 1;
}

/** Mutagen stat multiplier bonus. Adaptive: 1.5× */
export function getMutagenStatMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'adaptive_mutation') ? 1.5 : 1;
}

/** Whether adaptive mutation should clear existing mutations on pick */
export function shouldClearMutations(effects: CrisisEffectId[]): boolean {
  return hasEffect(effects, 'adaptive_mutation');
}

/** Upgrade cost reduction (additive fraction). Gene Trade: 0.4 */
export function getUpgradeCostReduction(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'gene_trade') ? 0.4 : 0;
}

/** Upgrade stat effectiveness multiplier. Gene Trade: 0.6 */
export function getUpgradeStatMult(effects: CrisisEffectId[]): number {
  return hasEffect(effects, 'gene_trade') ? 0.6 : 1;
}

/** Check if a crisis event is currently pending (UI should show event instead of shop) */
export function isCrisisPending(state: CrisisState): boolean {
  return state.pendingEvent !== null;
}

/** Get active effects description for HUD display */
export function getActiveEffectLabels(effects: CrisisEffectId[]): Array<{ id: CrisisEffectId; name: string; icon: string; color: string }> {
  const lookup: Record<CrisisEffectId, { name: string; icon: string; color: string }> = {
    meltdown_protocol: { name: 'Meltdown', icon: '💥', color: '#ef4444' },
    containment_override: { name: 'Containment', icon: '🛡️', color: '#60a5fa' },
    time_echo: { name: 'Time Echo', icon: '👻', color: '#a78bfa' },
    phase_shift: { name: 'Phase Shift', icon: '🌊', color: '#38bdf8' },
    adaptive_mutation: { name: 'Adaptive', icon: '⚗️', color: '#fbbf24' },
    gene_trade: { name: 'Gene Trade', icon: '💰', color: '#fb923c' },
    neural_link: { name: 'Neural Link', icon: '🧠', color: '#f472b6' },
    symbiote_bond: { name: 'Symbiote', icon: '🩸', color: '#34d399' },
  };
  return effects.map((id) => ({ id, ...lookup[id] }));
}
