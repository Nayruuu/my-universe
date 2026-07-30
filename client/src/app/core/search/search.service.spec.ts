import { TestBed } from '@angular/core/testing';
import { SpaceObject } from '../../../data/models/universe.models';
import { SearchService } from './search.service';

describe('SearchService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SearchService] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('construit puis interroge l’index local avec les valeurs par défaut', () => {
    const service = TestBed.inject(SearchService);

    service.setData([object('earth', 'Terre')]);

    expect(service.search('terre')).toEqual([
      expect.objectContaining({ id: 'earth', name: 'Terre', type: 'planet' }),
    ]);
    expect(service.search('inconnu')).toEqual([]);
  });

  it('fusionne les entrées de catalogue et respecte la limite demandée', () => {
    const service = TestBed.inject(SearchService);

    service.setData(
      [object('sun', 'Soleil')],
      [
        {
          id: 'hyg-1',
          name: 'Sirius',
          aliases: ['Alpha Canis Majoris'],
          type: 'star',
        },
        {
          id: 'hyg-2',
          name: 'Sirius B',
          aliases: [],
          type: 'star',
        },
      ],
    );

    expect(service.search('sirius', 1)).toHaveLength(1);
    expect(service.search('alpha')).toEqual([
      expect.objectContaining({ id: 'hyg-1', name: 'Sirius' }),
    ]);
  });
});

function object(id: string, name: string): SpaceObject {
  return {
    id,
    name,
    type: id === 'sun' ? 'star' : 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
