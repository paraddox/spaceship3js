/**
 * Onboarding system — first-run tutorial tips that guide new players
 * through the core loop: build a ship → launch → fight → return.
 *
 * Design: Non-blocking contextual tips shown in the editor and after
 * first combat. Dismissible. Persists completion in localStorage.
 * Once onboarding is complete, tips never show again.
 */

export const ONBOARDING_STORAGE_KEY = 'spachip3js.onboarding';

/** Flags tracking what the player has done. */
export interface OnboardingState {
  /** Whether the player has seen the editor before. */
  hasSeenEditor: boolean;
  /** Whether the player has launched at least one flight. */
  hasLaunchedFlight: boolean;
  /** Whether the player has completed any encounter. */
  hasCompletedEncounter: boolean;
  /** Whether the player dismissed the editor tips. */
  editorTipsDismissed: boolean;
  /** Whether the player dismissed the post-flight tips. */
  postFlightTipsDismissed: boolean;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  hasSeenEditor: false,
  hasLaunchedFlight: false,
  hasCompletedEncounter: false,
  editorTipsDismissed: false,
  postFlightTipsDismissed: false,
};

/**
 * Returns true when onboarding is fully complete and no tips should show.
 */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return (
    state.editorTipsDismissed &&
    state.postFlightTipsDismissed
  );
}

/**
 * Returns true if editor tips should be visible.
 * Shows until the player dismisses them or onboarding is complete.
 */
export function shouldShowEditorTips(state: OnboardingState): boolean {
  if (state.editorTipsDismissed) return false;
  // Show if the player hasn't completed onboarding yet
  if (!state.hasLaunchedFlight || !state.hasCompletedEncounter) return true;
  return false;
}

/**
 * Returns true if post-flight (welcome-back) tips should show.
 * Shows once after the first flight, until dismissed.
 */
export function shouldShowPostFlightTips(state: OnboardingState): boolean {
  if (state.postFlightTipsDismissed) return false;
  return state.hasLaunchedFlight;
}

/**
 * Returns the appropriate editor tip message based on what the player
 * has and hasn't done yet.
 */
export function getEditorTipMessage(state: OnboardingState): string {
  if (!state.hasLaunchedFlight) {
    return 'Welcome, Commander! Start by clicking <strong>Load Example</strong> to get a ready-made ship, or pick modules from the palette below. When your ship is ready, hit <strong>Launch Flight Test</strong> to take it into combat.';
  }
  return 'Good to have you back! Check your <strong>Endless Prep Bay</strong> for legacy bonuses and salvaged blueprints. Try the <strong>∞ Endless Gauntlet</strong> for infinite escalating waves.';
}

/**
 * Returns the post-flight tip shown after returning from combat.
 */
export function getPostFlightTipMessage(state: OnboardingState): string {
  if (!state.hasCompletedEncounter) {
    return 'Your first flight is in the books! In the editor, try different module combinations and crew assignments. More modules unlock as you complete encounters and earn credits.';
  }
  return 'Encounter complete! Check the <strong>Module Palette</strong> for newly unlockable modules. Your progress carries over between sessions.';
}

/** Mark that the player has entered the editor. */
export function markSeenEditor(state: OnboardingState): OnboardingState {
  return { ...state, hasSeenEditor: true };
}

/** Mark that the player has launched a flight. */
export function markLaunchedFlight(state: OnboardingState): OnboardingState {
  return { ...state, hasLaunchedFlight: true };
}

/** Mark that the player completed an encounter. */
export function markCompletedEncounter(state: OnboardingState): OnboardingState {
  return { ...state, hasCompletedEncounter: true };
}

/** Dismiss editor tips. */
export function dismissEditorTips(state: OnboardingState): OnboardingState {
  return { ...state, editorTipsDismissed: true };
}

/** Dismiss post-flight tips. */
export function dismissPostFlightTips(state: OnboardingState): OnboardingState {
  return { ...state, postFlightTipsDismissed: true };
}

/** Load onboarding state from localStorage. */
export function loadOnboardingState(): OnboardingState {
  try {
    const saved = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_ONBOARDING_STATE };
    const data = JSON.parse(saved) as Partial<OnboardingState>;
    return {
      hasSeenEditor: Boolean(data.hasSeenEditor),
      hasLaunchedFlight: Boolean(data.hasLaunchedFlight),
      hasCompletedEncounter: Boolean(data.hasCompletedEncounter),
      editorTipsDismissed: Boolean(data.editorTipsDismissed),
      postFlightTipsDismissed: Boolean(data.postFlightTipsDismissed),
    };
  } catch {
    return { ...DEFAULT_ONBOARDING_STATE };
  }
}

/** Persist onboarding state to localStorage. */
export function persistOnboardingState(state: OnboardingState): void {
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
}
