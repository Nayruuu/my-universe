import type { SpaceObjectType } from '../../data/models/universe.models';
import {
  getLabelPriority,
  getLabelTextColor,
  getMaximumCatalogLabelRank,
  getMaximumLabelCount,
  isLabelVisibleAtLevel,
  isScaleLandmarkAtLevel,
  type LabelObject,
} from './label-visibility-policy';

describe('label visibility policy', () => {
  it('préserve les repères permanents quand la carte change d’échelle', () => {
    const sun = createObject('sun', 'star');
    const milkyWay = createObject('milky-way', 'galaxy');

    expect(isScaleLandmarkAtLevel(sun, 2)).toBe(true);
    expect(isScaleLandmarkAtLevel(milkyWay, 2)).toBe(false);
    expect(isScaleLandmarkAtLevel(sun, 3)).toBe(false);
    expect(isScaleLandmarkAtLevel(milkyWay, 3)).toBe(true);
  });

  it('conserve les budgets de densité par qualité et niveau de détail', () => {
    expect(getMaximumLabelCount('low', 2, 'minimal')).toBe(14);
    expect(getMaximumLabelCount('high', 2, 'dense')).toBe(144);
    expect(getMaximumCatalogLabelRank('medium', 1, 'balanced')).toBe(1_400);
  });

  it('réserve les entrées de catalogue stellaire aux niveaux prévus', () => {
    const catalogStar = createObject('hyg-42', 'star', { catalogRecordIndex: 42 });

    expect(isLabelVisibleAtLevel(catalogStar, 2, 'high')).toBe(true);
    expect(isLabelVisibleAtLevel(catalogStar, 3, 'high')).toBe(false);
    expect(getLabelPriority(catalogStar, 2)).toBe(1_042);
  });

  it('préserve l’accent cartographique du Système solaire', () => {
    const earth = createObject('earth', 'planet');

    expect(getLabelTextColor(earth, false, 1)).toBe('#43b4dd');
    expect(getLabelTextColor(earth, true, 1)).toBe('#9ae8ff');
  });
});

function createObject(
  id: string,
  type: SpaceObjectType,
  metadata?: LabelObject['metadata'],
): LabelObject {
  return {
    id,
    name: id,
    type,
    metadata,
  };
}
