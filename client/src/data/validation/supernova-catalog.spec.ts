import supernovaSource from '../../../public/data/supernovas/catalog.json';
import { equatorialJ2000ToGalacticScene } from '../../engine/coordinates/galactic-reference-frame';
import { parseUniverseDataset } from './dataset-validator';

const LIGHT_YEARS_PER_PARSEC = 3.261_56;

describe('catalogue éditorial des supernovas', () => {
  it('contient six événements ou rémanents historiques documentés et recherchables', () => {
    const dataset = parseUniverseDataset(supernovaSource, 'supernovas');

    expect(dataset.objects).toHaveLength(6);
    expect(dataset.objects.map((object) => object.id)).toEqual([
      'sn-1006',
      'crab-nebula',
      'tycho-supernova',
      'kepler-supernova',
      'cassiopeia-a',
      'sn-1987a',
    ]);
    expect(dataset.objects.every((object) => object.scientificConfidence === 'observed')).toBe(
      true,
    );
    expect(
      dataset.objects.every(
        (object) =>
          typeof object.metadata?.['sourceUrl'] === 'string' &&
          typeof object.metadata?.['coordinateSourceUrl'] === 'string' &&
          object.metadata?.['appearanceConfidence'] === 'illustrative',
      ),
    ).toBe(true);
  });

  it('conserve les coordonnées J2000 et les distances publiées dans la position cartographique', () => {
    const dataset = parseUniverseDataset(supernovaSource, 'supernovas');

    for (const object of dataset.objects.filter((candidate) => candidate.id !== 'sn-1987a')) {
      const provider = object.positionProvider;

      expect(provider.type).toBe('static');
      if (provider.type !== 'static') {
        throw new Error(`Position statique absente pour ${object.id}.`);
      }
      const distanceLy = requiredMetadataNumber(object.metadata, 'distanceLy');
      const rightAscensionDegrees = requiredMetadataNumber(
        object.metadata,
        'rightAscensionDegrees',
      );
      const declinationDegrees = requiredMetadataNumber(object.metadata, 'declinationDegrees');
      const expected = equatorialToGalacticScene(
        rightAscensionDegrees,
        declinationDegrees,
        distanceLy / LIGHT_YEARS_PER_PARSEC,
      );

      expect(provider.unit).toBe('parsec');
      expect(provider.position[0]).toBeCloseTo(expected.x, 3);
      expect(provider.position[1]).toBeCloseTo(expected.y, 3);
      expect(provider.position[2]).toBeCloseTo(expected.z, 3);
    }
  });

  it('place SN 1987A relativement au Grand Nuage de Magellan', () => {
    const dataset = parseUniverseDataset(supernovaSource, 'supernovas');
    const supernova = dataset.objects.find((object) => object.id === 'sn-1987a');

    expect(supernova).toMatchObject({
      parentId: 'large-magellanic-cloud',
      referenceFrame: 'local-group',
      positionProvider: {
        type: 'static',
        position: [0, 0, 0],
        unit: 'parsec',
      },
    });
    expect(supernova?.metadata?.['hostGalaxy']).toBe('Grand Nuage de Magellan');
    expect(supernova?.metadata?.['visualPeakJulianDay']).toBe(2_446_849.5);
  });
});

function equatorialToGalacticScene(
  rightAscensionDegrees: number,
  declinationDegrees: number,
  distanceParsec: number,
): { x: number; y: number; z: number } {
  const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
  const declination = (declinationDegrees * Math.PI) / 180;

  return equatorialJ2000ToGalacticScene({
    x: distanceParsec * Math.cos(declination) * Math.cos(rightAscension),
    y: distanceParsec * Math.cos(declination) * Math.sin(rightAscension),
    z: distanceParsec * Math.sin(declination),
  });
}

function requiredMetadataNumber(
  metadata: Readonly<Record<string, string | number | boolean>> | undefined,
  key: string,
): number {
  const value = metadata?.[key];

  if (typeof value !== 'number') {
    throw new Error(`Métadonnée numérique ${key} absente.`);
  }

  return value;
}
