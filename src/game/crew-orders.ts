import type { CrewAllocation } from '../core/types';

const EPSILON = 0.005;

type CrewRole = 'pilot' | 'gunner' | 'engineer' | 'tactician';

export type CrewOrderId = 'pilot_surge' | 'gunner_focus' | 'engineer_reroute' | 'tactician_link';

export interface CrewOrderDef {
  id: CrewOrderId;
  role: CrewRole;
  displayName: string;
  icon: string;
  hotkey: string;
  color: string;
  description: string;
}

export interface CrewOrdersState {
  pilotCooldownRemaining: number;
  pilotActiveRemaining: number;
  gunnerCooldownRemaining: number;
  gunnerActiveRemaining: number;
  gunnerTargetId: string | null;
  gunnerTargetLabel: string | null;
  engineerCooldownRemaining: number;
  engineerActiveRemaining: number;
  tacticianCooldownRemaining: number;
  tacticianActiveRemaining: number;
  tacticianTargetId: string | null;
  tacticianTargetLabel: string | null;
}

export const CREW_ORDER_DEFS: CrewOrderDef[] = [
  {
    id: 'pilot_surge',
    role: 'pilot',
    displayName: 'Pilot Surge',
    icon: '🧭',
    hotkey: 'Z',
    color: '#38bdf8',
    description: 'Burst handling and velocity. Instantly refreshes dash.',
  },
  {
    id: 'gunner_focus',
    role: 'gunner',
    displayName: 'Gunner Focus',
    icon: '🎯',
    hotkey: 'X',
    color: '#fb923c',
    description: 'Mark a target and sharpen the entire firing solution around it.',
  },
  {
    id: 'engineer_reroute',
    role: 'engineer',
    displayName: 'Engineer Reroute',
    icon: '🔧',
    hotkey: 'C',
    color: '#34d399',
    description: 'Dump heat, restore shields, and push the reactors into a cooling window.',
  },
  {
    id: 'tactician_link',
    role: 'tactician',
    displayName: 'Tactician Link',
    icon: '📡',
    hotkey: 'B',
    color: '#a78bfa',
    description: 'Network wingmen and drones onto a called target while stabilizing combos.',
  },
];

export function createCrewOrdersState(): CrewOrdersState {
  return {
    pilotCooldownRemaining: 0,
    pilotActiveRemaining: 0,
    gunnerCooldownRemaining: 0,
    gunnerActiveRemaining: 0,
    gunnerTargetId: null,
    gunnerTargetLabel: null,
    engineerCooldownRemaining: 0,
    engineerActiveRemaining: 0,
    tacticianCooldownRemaining: 0,
    tacticianActiveRemaining: 0,
    tacticianTargetId: null,
    tacticianTargetLabel: null,
  };
}

export function tickCrewOrders(state: CrewOrdersState, dt: number): CrewOrdersState {
  const next: CrewOrdersState = {
    ...state,
    pilotCooldownRemaining: tickTimer(state.pilotCooldownRemaining, dt),
    pilotActiveRemaining: tickTimer(state.pilotActiveRemaining, dt),
    gunnerCooldownRemaining: tickTimer(state.gunnerCooldownRemaining, dt),
    gunnerActiveRemaining: tickTimer(state.gunnerActiveRemaining, dt),
    engineerCooldownRemaining: tickTimer(state.engineerCooldownRemaining, dt),
    engineerActiveRemaining: tickTimer(state.engineerActiveRemaining, dt),
    tacticianCooldownRemaining: tickTimer(state.tacticianCooldownRemaining, dt),
    tacticianActiveRemaining: tickTimer(state.tacticianActiveRemaining, dt),
    gunnerTargetId: state.gunnerTargetId,
    gunnerTargetLabel: state.gunnerTargetLabel,
    tacticianTargetId: state.tacticianTargetId,
    tacticianTargetLabel: state.tacticianTargetLabel,
  };

  if (!isOrderActive(next, 'gunner_focus')) {
    next.gunnerTargetId = null;
    next.gunnerTargetLabel = null;
  }
  if (!isOrderActive(next, 'tactician_link')) {
    next.tacticianTargetId = null;
    next.tacticianTargetLabel = null;
  }
  return next;
}

export function canActivateCrewOrder(state: CrewOrdersState, id: CrewOrderId, crew: CrewAllocation): boolean {
  const points = getCrewPoints(crew, getCrewRole(id));
  if (points <= 0) return false;
  return getCooldownRemaining(state, id) <= EPSILON;
}

export function activatePilotSurge(state: CrewOrdersState, crew: CrewAllocation): CrewOrdersState {
  return {
    ...state,
    pilotCooldownRemaining: getCrewOrderCooldown('pilot_surge', crew),
    pilotActiveRemaining: getCrewOrderDuration('pilot_surge', crew),
  };
}

export function activateGunnerFocus(
  state: CrewOrdersState,
  crew: CrewAllocation,
  targetId: string,
  targetLabel: string,
): CrewOrdersState {
  return {
    ...state,
    gunnerCooldownRemaining: getCrewOrderCooldown('gunner_focus', crew),
    gunnerActiveRemaining: getCrewOrderDuration('gunner_focus', crew),
    gunnerTargetId: targetId,
    gunnerTargetLabel: targetLabel,
  };
}

export function activateEngineerReroute(state: CrewOrdersState, crew: CrewAllocation): CrewOrdersState {
  return {
    ...state,
    engineerCooldownRemaining: getCrewOrderCooldown('engineer_reroute', crew),
    engineerActiveRemaining: getCrewOrderDuration('engineer_reroute', crew),
  };
}

export function activateTacticianLink(
  state: CrewOrdersState,
  crew: CrewAllocation,
  targetId: string | null,
  targetLabel: string | null,
): CrewOrdersState {
  return {
    ...state,
    tacticianCooldownRemaining: getCrewOrderCooldown('tactician_link', crew),
    tacticianActiveRemaining: getCrewOrderDuration('tactician_link', crew),
    tacticianTargetId: targetId,
    tacticianTargetLabel: targetLabel,
  };
}

export function clearCrewOrderTarget(state: CrewOrdersState, targetId: string): CrewOrdersState {
  return {
    ...state,
    gunnerTargetId: state.gunnerTargetId === targetId ? null : state.gunnerTargetId,
    gunnerTargetLabel: state.gunnerTargetId === targetId ? null : state.gunnerTargetLabel,
    tacticianTargetId: state.tacticianTargetId === targetId ? null : state.tacticianTargetId,
    tacticianTargetLabel: state.tacticianTargetId === targetId ? null : state.tacticianTargetLabel,
  };
}

export function getCrewOrderTargetId(state: CrewOrdersState): string | null {
  if (isOrderActive(state, 'gunner_focus') && state.gunnerTargetId) return state.gunnerTargetId;
  if (isOrderActive(state, 'tactician_link') && state.tacticianTargetId) return state.tacticianTargetId;
  return null;
}

export function getCrewOrderTargetLabel(state: CrewOrdersState): string | null {
  if (isOrderActive(state, 'gunner_focus') && state.gunnerTargetLabel) return state.gunnerTargetLabel;
  if (isOrderActive(state, 'tactician_link') && state.tacticianTargetLabel) return state.tacticianTargetLabel;
  return null;
}

export function isOrderActive(state: CrewOrdersState, id: CrewOrderId): boolean {
  return getActiveRemaining(state, id) > EPSILON;
}

export function getActiveRemaining(state: CrewOrdersState, id: CrewOrderId): number {
  switch (id) {
    case 'pilot_surge': return state.pilotActiveRemaining;
    case 'gunner_focus': return state.gunnerActiveRemaining;
    case 'engineer_reroute': return state.engineerActiveRemaining;
    case 'tactician_link': return state.tacticianActiveRemaining;
  }
}

export function getCooldownRemaining(state: CrewOrdersState, id: CrewOrderId): number {
  switch (id) {
    case 'pilot_surge': return state.pilotCooldownRemaining;
    case 'gunner_focus': return state.gunnerCooldownRemaining;
    case 'engineer_reroute': return state.engineerCooldownRemaining;
    case 'tactician_link': return state.tacticianCooldownRemaining;
  }
}

export function getCrewOrderDuration(id: CrewOrderId, crew: CrewAllocation): number {
  const points = Math.max(1, getCrewPoints(crew, getCrewRole(id)));
  switch (id) {
    case 'pilot_surge': return 2.4 + points * 0.5;
    case 'gunner_focus': return 4.5 + points * 0.6;
    case 'engineer_reroute': return 3.5 + points * 0.5;
    case 'tactician_link': return 4.5 + points * 0.65;
  }
}

export function getCrewOrderCooldown(id: CrewOrderId, crew: CrewAllocation): number {
  const points = Math.max(1, getCrewPoints(crew, getCrewRole(id)));
  switch (id) {
    case 'pilot_surge': return Math.max(9, 15 - points * 0.9);
    case 'gunner_focus': return Math.max(10, 17 - points * 1.0);
    case 'engineer_reroute': return Math.max(12, 18 - points * 0.9);
    case 'tactician_link': return Math.max(12, 19 - points * 1.1);
  }
}

export function getPilotThrustMultiplier(state: CrewOrdersState, crew: CrewAllocation): number {
  if (!isOrderActive(state, 'pilot_surge')) return 1;
  return 1.16 + getCrewPoints(crew, 'pilot') * 0.05;
}

export function getPilotTurnMultiplier(state: CrewOrdersState, crew: CrewAllocation): number {
  if (!isOrderActive(state, 'pilot_surge')) return 1;
  return 1.12 + getCrewPoints(crew, 'pilot') * 0.04;
}

export function getGunnerCadenceMultiplier(state: CrewOrdersState, crew: CrewAllocation): number {
  if (!isOrderActive(state, 'gunner_focus')) return 1;
  return 1.05 + getCrewPoints(crew, 'gunner') * 0.03;
}

export function getGunnerFocusDamageMultiplier(
  state: CrewOrdersState,
  crew: CrewAllocation,
  targetId: string | null,
): number {
  if (!targetId || !isOrderActive(state, 'gunner_focus') || state.gunnerTargetId !== targetId) return 1;
  return 1.12 + getCrewPoints(crew, 'gunner') * 0.05;
}

export function getEngineerCoolingMultiplier(state: CrewOrdersState, crew: CrewAllocation): number {
  if (!isOrderActive(state, 'engineer_reroute')) return 1;
  return 1.16 + getCrewPoints(crew, 'engineer') * 0.05;
}

export function getEngineerShieldRechargeMultiplier(state: CrewOrdersState, crew: CrewAllocation): number {
  if (!isOrderActive(state, 'engineer_reroute')) return 1;
  return 1.18 + getCrewPoints(crew, 'engineer') * 0.06;
}

export function getEngineerHeatVentFraction(crew: CrewAllocation): number {
  return 0.18 + getCrewPoints(crew, 'engineer') * 0.08;
}

export function getEngineerShieldBurst(crew: CrewAllocation): number {
  return 8 + getCrewPoints(crew, 'engineer') * 7;
}

export function getEngineerRepairFraction(crew: CrewAllocation): number {
  return 0.08 + getCrewPoints(crew, 'engineer') * 0.035;
}

export function getTacticianCadenceMultiplier(state: CrewOrdersState, crew: CrewAllocation): number {
  if (!isOrderActive(state, 'tactician_link')) return 1;
  return 1.04 + getCrewPoints(crew, 'tactician') * 0.03;
}

export function getTacticianComboDecayMultiplier(state: CrewOrdersState, crew: CrewAllocation): number {
  if (!isOrderActive(state, 'tactician_link')) return 1;
  return Math.max(0.45, 0.86 - getCrewPoints(crew, 'tactician') * 0.07);
}

export function getTacticianDroneDamageMultiplier(
  state: CrewOrdersState,
  crew: CrewAllocation,
  targetId: string | null,
): number {
  if (!targetId || !isOrderActive(state, 'tactician_link') || state.tacticianTargetId !== targetId) return 1;
  return 1.08 + getCrewPoints(crew, 'tactician') * 0.04;
}

export function getCrewOrderDef(id: CrewOrderId): CrewOrderDef {
  return CREW_ORDER_DEFS.find((def) => def.id === id) ?? CREW_ORDER_DEFS[0];
}

function getCrewRole(id: CrewOrderId): CrewRole {
  return getCrewOrderDef(id).role;
}

function getCrewPoints(crew: CrewAllocation, role: CrewRole): number {
  return Math.max(0, Math.floor(crew[role] ?? 0));
}

function tickTimer(value: number, dt: number): number {
  return Math.max(0, value - dt);
}
