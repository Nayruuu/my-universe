import featuredStarsSource from '../../../public/data/stars/nearby-stars.json';
import { parseUniverseDataset } from './dataset-validator';

describe('étoiles éditoriales liées au catalogue', () => {
  const objects = parseUniverseDataset(featuredStarsSource, 'nearby-stars').objects;

  it('référence chaque étoile par un identifiant HYG reproductible sans coordonnées manuelles', () => {
    expect(objects).toHaveLength(16);
    expect(
      objects.every(
        ({ positionProvider }) =>
          positionProvider.type === 'catalog' &&
          positionProvider.catalogId === 'hyg-v41-bright-stars' &&
          positionProvider.identifier.trim().length > 0,
      ),
    ).toBe(true);
    expect(
      new Set(
        objects.map(({ positionProvider }) =>
          positionProvider.type === 'catalog' ? positionProvider.identifier : '',
        ),
      ).size,
    ).toBe(objects.length);
    expect(
      objects.some(({ metadata }) => metadata?.['source'] === 'Catalogue stellaire simplifié'),
    ).toBe(false);
    expect(objects.find(({ id }) => id === 'wolf-359')?.positionProvider).toEqual({
      type: 'catalog',
      catalogId: 'hyg-v41-bright-stars',
      identifier: 'Wolf 359',
    });
  });
});
