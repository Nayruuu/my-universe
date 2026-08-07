import { parseManifest } from './manifest-validator';
import { parsePositionProvider } from './position-provider-validator';

describe('dataset validation boundaries', () => {
  it('parses a JSON manifest entry independently from universe objects', () => {
    expect(
      parseManifest({
        version: '1.0.0',
        datasets: [{ id: 'solar-system', url: '/data/solar-system.json', type: 'json' }],
      }),
    ).toEqual({
      version: '1.0.0',
      datasets: [{ id: 'solar-system', url: '/data/solar-system.json', type: 'json' }],
    });
  });

  it('validates a position provider independently from object presentation', () => {
    expect(
      parsePositionProvider(
        {
          type: 'catalog',
          catalogId: 'hyg-v4',
          identifier: '32349',
        },
        'sirius',
      ),
    ).toEqual({ type: 'catalog', catalogId: 'hyg-v4', identifier: '32349' });

    expect(() =>
      parsePositionProvider(
        {
          type: 'ephemeris',
          body: 'moon',
          origin: 'sun',
          orbitalPeriodDays: 27.321_661,
          orbitEpochJulianDay: 2_451_545,
        },
        'moon',
      ),
    ).toThrow('Fournisseur de position invalide pour moon.');
  });
});
