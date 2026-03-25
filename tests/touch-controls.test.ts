import { describe, expect, it } from 'vitest';
import {
  MOBILE_TOUCH_BREAKPOINT,
  clampStickDelta,
  normalizeVirtualStick,
  shouldEnableTouchControls,
} from '../src/game/touch-controls';

describe('touch controls', () => {
  it('enables touch controls for touch-first environments', () => {
    expect(shouldEnableTouchControls({
      viewportWidth: 1400,
      maxTouchPoints: 2,
      coarsePointer: false,
    })).toBe(true);

    expect(shouldEnableTouchControls({
      viewportWidth: 1400,
      maxTouchPoints: 0,
      coarsePointer: true,
    })).toBe(true);

    expect(shouldEnableTouchControls({
      viewportWidth: MOBILE_TOUCH_BREAKPOINT,
      maxTouchPoints: 0,
      coarsePointer: false,
    })).toBe(true);
  });

  it('keeps touch controls off for wide precision-pointer desktops', () => {
    expect(shouldEnableTouchControls({
      viewportWidth: MOBILE_TOUCH_BREAKPOINT + 200,
      maxTouchPoints: 0,
      coarsePointer: false,
    })).toBe(false);
  });

  it('clamps stick delta to the edge of the pad', () => {
    expect(clampStickDelta(30, 40, 25)).toEqual({ deltaX: 15, deltaY: 20 });
    expect(clampStickDelta(8, 6, 25)).toEqual({ deltaX: 8, deltaY: 6 });
  });

  it('normalizes virtual stick input with deadzone handling', () => {
    const deadzone = normalizeVirtualStick(2, 1, 20);
    expect(deadzone).toMatchObject({ x: 0, y: 0, magnitude: 0 });

    const fullTilt = normalizeVirtualStick(24, 0, 20);
    expect(fullTilt.x).toBeCloseTo(1, 5);
    expect(fullTilt.y).toBeCloseTo(0, 5);
    expect(fullTilt.magnitude).toBeCloseTo(1, 5);
    expect(fullTilt.thumbX).toBeCloseTo(20, 5);
    expect(fullTilt.thumbY).toBeCloseTo(0, 5);
  });
});
