import { WheelZoomNormalizer } from './wheel-zoom-normalizer';
import { equivalentWheelDeltaForOctaves } from './zoom-physics';

describe('WheelZoomNormalizer', () => {
  it('borne une forte impulsion puis régule une rafale selon le temps écoulé', () => {
    const normalizer = new WheelZoomNormalizer();

    expect(normalizer.normalize(-749, 0, 1_000, 600)).toBeCloseTo(-57.7622650467, 10);
    expect(normalizer.continuesGesture).toBe(false);
    expect(normalizer.normalize(-375, 0, 1_016, 600)).toBeCloseTo(-13.3084258668, 10);
    expect(normalizer.continuesGesture).toBe(true);
    expect(normalizer.normalize(-375, 0, 1_033, 600)).toBeCloseTo(-14.1402024834, 10);
    expect(normalizer.continuesGesture).toBe(true);
  });

  it('conserve la même vitesse logarithmique à 60 Hz et à 120 Hz', () => {
    const integrateOneSecond = (sampleRate: number): number => {
      const normalizer = new WheelZoomNormalizer();
      let total = normalizer.normalize(1e9, 0, 0, 600);

      for (let index = 1; index <= sampleRate; index += 1) {
        total += normalizer.normalize(1e9, 0, (index * 1_000) / sampleRate, 600);
      }

      return total;
    };
    const expected = equivalentWheelDeltaForOctaves(1.8 + 1 / 8);

    expect(integrateOneSecond(60)).toBeCloseTo(expected, 8);
    expect(integrateOneSecond(120)).toBeCloseTo(expected, 8);
  });

  it('conserve les gestes précis et ramène les modes ligne et page en pixels', () => {
    const normalizer = new WheelZoomNormalizer();

    expect(normalizer.normalize(-12, 0, 100, 600)).toBe(-12);
    normalizer.reset();
    expect(normalizer.normalize(-120, 0, 100, 600)).toBeCloseTo(-57.1046270096, 10);
    normalizer.reset();
    expect(normalizer.normalize(3, 1, 100, 600)).toBeCloseTo(42.5835958192, 10);
    normalizer.reset();
    expect(normalizer.normalize(-1, 2, 100, 600)).toBeCloseTo(-57.7622650465, 9);
  });

  it('réagit immédiatement à une inversion ou à la reprise après une pause', () => {
    const normalizer = new WheelZoomNormalizer();

    normalizer.normalize(-700, 0, 100, 600);
    normalizer.normalize(-700, 0, 116, 600);
    expect(normalizer.continuesGesture).toBe(true);
    expect(normalizer.normalize(700, 0, 132, 600)).toBeCloseTo(57.7622650467, 10);
    expect(normalizer.continuesGesture).toBe(false);
    expect(normalizer.normalize(700, 0, 400, 600)).toBeCloseTo(57.7622650467, 10);
    expect(normalizer.continuesGesture).toBe(false);
  });

  it('ignore les valeurs invalides et repart proprement après réinitialisation', () => {
    const normalizer = new WheelZoomNormalizer();

    expect(normalizer.normalize(0, 0, 100, 600)).toBe(0);
    expect(normalizer.continuesGesture).toBe(false);
    expect(normalizer.normalize(Number.NaN, 0, 100, 600)).toBe(0);
    expect(normalizer.normalize(100, 7, 100, 600)).toBeCloseTo(56.1254196132, 10);
    normalizer.reset();
    expect(normalizer.continuesGesture).toBe(false);
    expect(normalizer.normalize(1, 2, 100, 0)).toBeCloseTo(57.7622650467, 10);
    expect(normalizer.normalize(700, 0, 100, Number.NaN)).toBeCloseTo(6.9314718056, 10);
    normalizer.reset();
    expect(normalizer.normalize(700, 0, 100, 600)).toBeCloseTo(57.7622650467, 10);
  });
});
