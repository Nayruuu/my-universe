import type { SpaceObject } from '../../../data/models/universe.models';
import {
  createEarthSkyCatalog,
  createEarthSkyTarget,
  equatorialCoordinates,
} from './earth-sky-catalog';

describe('catalogue de la vue terrestre', () => {
  it('conserve les étoiles J2000 les plus lumineuses dans un ordre stable', () => {
    const catalog = createEarthSkyCatalog(
      [
        star('faint', 5, 40, 20, '#ffccaa'),
        star('bright', -1.4, 101, -16, '#aabbff'),
        star('medium', 2, 10, 30),
        { ...star('wrong-epoch', 0, 20, 10), metadata: { skyCoordinateEpoch: 'B1950' } },
        { ...star('missing-magnitude', 0, 20, 10), metadata: { skyCoordinateEpoch: 'J2000' } },
        { ...star('planet', 0, 20, 10), type: 'planet' },
      ],
      2,
    );

    expect(catalog).toEqual([
      {
        id: 'bright',
        name: 'bright',
        coordinates: { rightAscensionDegrees: 101, declinationDegrees: -16 },
        apparentMagnitude: -1.4,
        color: '#aabbff',
      },
      {
        id: 'medium',
        name: 'medium',
        coordinates: { rightAscensionDegrees: 10, declinationDegrees: 30 },
        apparentMagnitude: 2,
        color: '#dce9ff',
      },
    ]);
  });

  it('ignore les métadonnées incomplètes et rejette une limite invalide', () => {
    const base = star('star', 1, 10, 20);

    expect(equatorialCoordinates({ ...base, metadata: { rightAscensionDegrees: 10 } })).toBeNull();
    expect(equatorialCoordinates({ ...base, metadata: { declinationDegrees: 20 } })).toBeNull();
    expect(
      equatorialCoordinates({
        ...base,
        metadata: {
          rightAscensionDegrees: 10,
          declinationDegrees: 20,
          skyCoordinateEpoch: 'B1950',
        },
      }),
    ).toBeNull();
    expect(
      createEarthSkyCatalog(
        [{ ...base, metadata: { ...base.metadata, apparentMagnitude: Number.NaN } }],
        1,
      ),
    ).toEqual([]);
    expect(() => createEarthSkyCatalog([base], 0)).toThrow(RangeError);
    expect(() => createEarthSkyCatalog([base], 1.5)).toThrow(RangeError);
  });

  it('prépare toujours la cible observable, même sans magnitude publiée', () => {
    const target = createEarthSkyTarget({
      ...star('target', 1, 101, -16),
      metadata: {
        rightAscensionDegrees: 101,
        declinationDegrees: -16,
        skyCoordinateEpoch: 'J2000',
      },
    });

    expect(target).toMatchObject({ id: 'target', apparentMagnitude: 6, color: '#dce9ff' });
    expect(createEarthSkyTarget({ ...star('planet', 1, 0, 0), type: 'planet' })).toBeNull();
    expect(createEarthSkyTarget({ ...star('invalid', 1, 0, 0), metadata: {} })).toBeNull();
  });
});

function star(
  id: string,
  apparentMagnitude: number,
  rightAscensionDegrees: number,
  declinationDegrees: number,
  color?: string,
): SpaceObject {
  return {
    id,
    name: id,
    type: 'star',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive', color },
    positionProvider: { type: 'static', position: [1, 2, 3], unit: 'parsec' },
    metadata: {
      apparentMagnitude,
      rightAscensionDegrees,
      declinationDegrees,
      skyCoordinateEpoch: 'J2000',
    },
  };
}
