import { type SearchEntry, type SpaceObject } from '../../../data/models/universe.models';
import {
  finishCatalogPreparation,
  prepareCatalogIncrementally,
} from '../../../engine/core/catalog-preparation';
import { prepareExoplanetDiscoveryEntries } from './exoplanet-discovery';

describe('préparation de la découverte exoplanétaire', () => {
  it.each([0, 1, 511, 512, 513, 1_537])(
    'préserve le tri stable de %i entrées par lots',
    async (count) => {
      const entries: SearchEntry[] = Array.from({ length: count }, (_, index) => ({
        id: `planet-${index}`,
        name: 'Nom commun',
        aliases: [],
        type: 'exoplanet',
        metadata: { distanceParsec: index % 3 },
      }));
      const snapshot = structuredClone(entries);
      const pause = vi.fn(async () => undefined);
      const actual = await prepareCatalogIncrementally(
        prepareExoplanetDiscoveryEntries([], entries),
        pause,
      );
      const expected = entries
        .slice()
        .sort(
          (a, b) => Number(a.metadata!['distanceParsec']) - Number(b.metadata!['distanceParsec']),
        );

      expect(actual).toEqual(expected);
      expect(actual).toEqual(
        finishCatalogPreparation(prepareExoplanetDiscoveryEntries([], entries)),
      );
      expect(entries).toEqual(snapshot);
      expect(pause.mock.calls.length).toBeGreaterThanOrEqual(Math.floor((count * 2) / 512));
      for (let index = 0; index < count; index += 1) {
        expect(actual[index]).toBe(expected[index]);
      }
    },
  );

  it('conserve la priorité éditoriale et les parents même au-delà d’un lot', async () => {
    const objects: SpaceObject[] = Array.from({ length: 513 }, (_, index) => ({
      id: `public-${index}`,
      name: `Public ${index}`,
      type: index === 0 ? 'exoplanet' : 'star',
      parentId: index === 0 ? 'public-512' : undefined,
      referenceFrame: 'stellar',
      scientificConfidence: 'observed',
      visual: { visualRadius: 1, scaleMode: 'adaptive' },
      positionProvider: { type: 'static', position: [1, 0, 0], unit: 'parsec' },
    }));
    const entry: SearchEntry = { id: 'public-0', name: 'doublon', aliases: [], type: 'exoplanet' };
    const other: SearchEntry = { ...entry, id: 'other', name: 'Z' };
    const pause = vi.fn(async () => undefined);
    const actual = await prepareCatalogIncrementally(
      prepareExoplanetDiscoveryEntries(objects, [entry, other, other]),
      pause,
    );

    expect(actual).toHaveLength(2);
    expect(actual[0]).toMatchObject({
      id: 'public-0',
      name: 'Public 0',
      parentName: 'Public 512',
      metadata: { temperateCandidate: false },
    });
    expect(actual[1]).toBe(other);
    expect(pause).toHaveBeenCalledTimes(2);
  });
});
