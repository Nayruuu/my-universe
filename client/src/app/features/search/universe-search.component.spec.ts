import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchEntry, SpaceObjectType } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { SearchService } from '../../core/search/search.service';
import { UniverseSearchComponent } from './universe-search.component';

describe('UniverseSearchComponent', () => {
  const sirius: SearchEntry = {
    id: 'sirius',
    name: 'Sirius',
    aliases: [],
    type: 'star',
  };
  const earth: SearchEntry = {
    id: 'earth',
    name: 'Terre',
    aliases: ['Earth'],
    type: 'planet',
    parentName: 'Système solaire',
  };
  const search = vi.fn(() => [sirius]);
  const facade = {
    focus: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    search.mockReturnValue([sirius]);
    TestBed.configureTestingModule({
      imports: [UniverseSearchComponent],
      providers: [
        { provide: UniverseEngineFacade, useValue: facade },
        { provide: SearchService, useValue: { search } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('recherche au fil de la saisie puis centre le résultat choisi', () => {
    const component = createComponent();

    component.active.set(true);
    component.updateQuery(inputEvent('sir'));

    expect(component.query()).toBe('sir');
    expect(component.results()).toEqual([sirius]);
    expect(search).toHaveBeenCalledWith('sir');

    component.choose(sirius);

    expect(component.query()).toBe('');
    expect(component.active()).toBe(false);
    expect(facade.focus).toHaveBeenCalledWith('sirius');
  });

  it('efface la requête et traduit tous les types affichés', () => {
    const component = createComponent();
    const labels: readonly [SpaceObjectType, string][] = [
      ['star', 'Étoile'],
      ['planet', 'Planète'],
      ['moon', 'Lune'],
      ['galaxy', 'Galaxie'],
      ['dwarf-planet', 'Planète naine'],
      ['asteroid', 'Astéroïde'],
      ['comet', 'Comète'],
      ['universe', 'Objet'],
    ];

    component.query.set('mars');
    component.clear();

    expect(component.query()).toBe('');
    for (const [type, label] of labels) {
      expect(component.typeLabel(type)).toBe(label);
    }
  });

  it('rend les résultats, le parent de repli et l’état vide', () => {
    const fixture = TestBed.createComponent(UniverseSearchComponent);
    const component = fixture.componentInstance as unknown as UniverseSearchAccess;

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.results')).toBeNull();

    search.mockReturnValue([sirius, earth]);
    component.active.set(true);
    component.query.set('s');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.result')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Univers');
    expect(fixture.nativeElement.textContent).toContain('Système solaire');

    search.mockReturnValue([]);
    component.query.set('introuvable');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty-result')).not.toBeNull();

    component.active.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.results')).toBeNull();
  });
});

interface UniverseSearchAccess {
  readonly query: WritableSignal<string>;
  readonly active: WritableSignal<boolean>;
  readonly results: ReturnType<typeof signal<readonly SearchEntry[]>>;
  updateQuery(event: Event): void;
  choose(result: SearchEntry): void;
  clear(): void;
  typeLabel(type: SpaceObjectType): string;
}

function createComponent(): UniverseSearchAccess {
  return TestBed.createComponent(UniverseSearchComponent)
    .componentInstance as unknown as UniverseSearchAccess;
}

function inputEvent(value: string): Event {
  const input = document.createElement('input');
  const event = new Event('input');

  input.value = value;
  Object.defineProperty(event, 'target', { value: input });

  return event;
}
