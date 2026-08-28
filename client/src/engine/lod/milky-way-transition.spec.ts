import {
  calculateMilkyWayTransition,
  MILKY_WAY_TRANSITION_END,
  MILKY_WAY_TRANSITION_START,
} from './milky-way-transition';

describe('calculateMilkyWayTransition', () => {
  it('keeps the detailed galactic map at the Milky Way scale', () => {
    expect(calculateMilkyWayTransition(MILKY_WAY_TRANSITION_START)).toEqual({
      detailOpacity: 1,
      auraOpacity: 1,
      impostorOpacity: 0,
      detailScale: 1,
    });
    expect(calculateMilkyWayTransition(-1_000)).toEqual({
      detailOpacity: 1,
      auraOpacity: 1,
      impostorOpacity: 0,
      detailScale: 1,
    });
    for (let distance = -1_000; distance <= 1_000_000; distance += 1_000) {
      const scale = calculateMilkyWayTransition(distance).detailScale;

      expect(scale).toBeGreaterThanOrEqual(0.16);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });

  it('crossfades the detailed map, aura and distant impostor without a visual gap', () => {
    const middle = calculateMilkyWayTransition(
      (MILKY_WAY_TRANSITION_START + MILKY_WAY_TRANSITION_END) / 2,
    );

    expect(middle.detailOpacity).toBeGreaterThan(0);
    expect(middle.auraOpacity).toBeGreaterThan(0);
    expect(middle.impostorOpacity).toBeGreaterThan(0);
    expect(middle.detailScale).toBeGreaterThan(0.16);
    expect(middle.detailScale).toBeLessThan(1);

    for (
      let distance = MILKY_WAY_TRANSITION_START;
      distance <= MILKY_WAY_TRANSITION_END;
      distance += 200
    ) {
      const state = calculateMilkyWayTransition(distance);

      expect(
        Math.max(state.detailOpacity, state.auraOpacity, state.impostorOpacity),
      ).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('finishes on the compact distant representation at the Local Group scale', () => {
    expect(calculateMilkyWayTransition(MILKY_WAY_TRANSITION_END)).toEqual({
      detailOpacity: 0,
      auraOpacity: 0,
      impostorOpacity: 1,
      detailScale: 0.16,
    });
    expect(calculateMilkyWayTransition(1_000_000)).toEqual(
      calculateMilkyWayTransition(MILKY_WAY_TRANSITION_END),
    );
  });
});
