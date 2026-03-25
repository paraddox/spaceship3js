export interface TouchControlEnvironment {
  viewportWidth: number;
  maxTouchPoints: number;
  coarsePointer: boolean;
}

export interface VirtualStickState {
  x: number;
  y: number;
  magnitude: number;
  thumbX: number;
  thumbY: number;
}

export const MOBILE_TOUCH_BREAKPOINT = 900;
const DEFAULT_DEADZONE = 0.18;

export function shouldEnableTouchControls(env: TouchControlEnvironment): boolean {
  return env.maxTouchPoints > 0 || env.coarsePointer || env.viewportWidth <= MOBILE_TOUCH_BREAKPOINT;
}

export function clampStickDelta(deltaX: number, deltaY: number, radius: number): { deltaX: number; deltaY: number } {
  if (radius <= 0) return { deltaX: 0, deltaY: 0 };
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= radius) return { deltaX, deltaY };
  const scale = radius / distance;
  return {
    deltaX: deltaX * scale,
    deltaY: deltaY * scale,
  };
}

export function normalizeVirtualStick(deltaX: number, deltaY: number, radius: number, deadzone = DEFAULT_DEADZONE): VirtualStickState {
  const clamped = clampStickDelta(deltaX, deltaY, radius);
  if (radius <= 0) {
    return { x: 0, y: 0, magnitude: 0, thumbX: 0, thumbY: 0 };
  }
  const rawX = clamped.deltaX / radius;
  const rawY = clamped.deltaY / radius;
  const rawMagnitude = Math.min(1, Math.hypot(rawX, rawY));
  if (rawMagnitude <= deadzone) {
    return { x: 0, y: 0, magnitude: 0, thumbX: clamped.deltaX, thumbY: clamped.deltaY };
  }
  const normalizedMagnitude = (rawMagnitude - deadzone) / (1 - deadzone);
  const invMagnitude = rawMagnitude > 0 ? 1 / rawMagnitude : 0;
  return {
    x: rawX * invMagnitude * normalizedMagnitude,
    y: rawY * invMagnitude * normalizedMagnitude,
    magnitude: normalizedMagnitude,
    thumbX: clamped.deltaX,
    thumbY: clamped.deltaY,
  };
}

export function readTouchControlEnvironment(win: Window = window): TouchControlEnvironment {
  return {
    viewportWidth: win.innerWidth,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    coarsePointer: typeof win.matchMedia === 'function' ? win.matchMedia('(pointer: coarse)').matches : false,
  };
}
