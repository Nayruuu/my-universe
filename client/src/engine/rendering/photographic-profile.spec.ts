import { dampPhotographicExposure, getPhotographicProfile } from './photographic-profile';

describe('photographic rendering profiles', () => {
  it('adapts exposure and radiance to the astronomical scale', () => {
    const planetary = getPhotographicProfile(0, 'medium');
    const stellar = getPhotographicProfile(2, 'medium');
    const localGroup = getPhotographicProfile(4, 'medium');
    const cosmicWeb = getPhotographicProfile(6, 'medium');

    expect(stellar.starRadiance).toBeGreaterThan(planetary.starRadiance);
    expect(localGroup.galaxyRadiance).toBeGreaterThan(stellar.galaxyRadiance);
    expect(cosmicWeb.exposure).toBeGreaterThan(planetary.exposure);
  });

  it('keeps the same art direction while scaling luminous detail by quality', () => {
    const low = getPhotographicProfile(3, 'low');
    const medium = getPhotographicProfile(3, 'medium');
    const high = getPhotographicProfile(3, 'high');

    expect(low.starRadiance).toBeLessThan(medium.starRadiance);
    expect(medium.starRadiance).toBeLessThan(high.starRadiance);
    expect(low.galaxyRadiance).toBeLessThan(medium.galaxyRadiance);
    expect(medium.galaxyRadiance).toBeLessThan(high.galaxyRadiance);
    expect(low.exposure).toBeLessThan(high.exposure);
  });

  it('clamps unknown levels to the nearest supported photographic profile', () => {
    expect(getPhotographicProfile(-10, 'medium')).toEqual(getPhotographicProfile(0, 'medium'));
    expect(getPhotographicProfile(99, 'medium')).toEqual(getPhotographicProfile(6, 'medium'));
  });

  it('damps exposure changes without a flash or overshoot', () => {
    expect(dampPhotographicExposure(1, 1.2, 0)).toBe(1);
    const transition = dampPhotographicExposure(1, 1.2, 1 / 60);

    expect(transition).toBeGreaterThan(1);
    expect(transition).toBeLessThan(1.2);
    expect(dampPhotographicExposure(1, 1.2, 10)).toBeCloseTo(1.2, 8);
  });
});
