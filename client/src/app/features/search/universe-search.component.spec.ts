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
  const revision = signal(0);
  const exoplanetCount = signal(6_333);
  const exoplanet: SearchEntry = {
    id: 'kepler-452-b',
    name: 'Kepler-452 b',
    aliases: [],
    type: 'exoplanet',
    parentName: 'Kepler-452',
    metadata: {
      distanceParsec: 551.7,
      radiusEarth: 1.63,
      discoveryMethod: 'Transit',
      temperateCandidate: true,
    },
  };
  const discoverExoplanets = vi.fn(() => [exoplanet]);
  const facade = {
    focus: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    search.mockReturnValue([sirius]);
    discoverExoplanets.mockReturnValue([exoplanet]);
    TestBed.configureTestingModule({
      imports: [UniverseSearchComponent],
      providers: [
        { provide: UniverseEngineFacade, useValue: facade },
        {
          provide: SearchService,
          useValue: { search, revision, exoplanetCount, discoverExoplanets },
        },
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

    component.active.set(false);
    component.updateQuery(inputEvent('sirius'));
    expect(component.active()).toBe(true);

    component.choose(sirius);

    expect(component.query()).toBe('');
    expect(component.active()).toBe(false);
    expect(facade.focus).toHaveBeenCalledWith('sirius');
  });

  it('émet un résultat sans quitter la vue lorsque la navigation est déléguée au parent', () => {
    const fixture = TestBed.createComponent(UniverseSearchComponent);
    const component = fixture.componentInstance as unknown as UniverseSearchAccess;
    const selected = vi.fn();

    fixture.componentRef.setInput('selectionMode', 'emit');
    fixture.componentRef.setInput('allowedTypes', ['star']);
    fixture.componentRef.setInput('placeholder', 'Rechercher une étoile');
    component.resultSelected.subscribe(selected);
    component.choose(sirius);
    fixture.detectChanges();

    expect(selected).toHaveBeenCalledWith(sirius);
    expect(facade.focus).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement).placeholder,
    ).toBe('Rechercher une étoile');
    expect(fixture.nativeElement.querySelector('.catalog-button')).toBeNull();

    search.mockReturnValue([earth, sirius]);
    component.updateQuery(inputEvent('s'));
    expect(component.results()).toEqual([sirius]);
  });

  it('efface la requête et traduit tous les types affichés', () => {
    const component = createComponent();
    const labels: readonly [SpaceObjectType, string][] = [
      ['star', 'Étoile'],
      ['planet', 'Planète'],
      ['exoplanet', 'Exoplanète'],
      ['moon', 'Lune'],
      ['galaxy', 'Galaxie'],
      ['black-hole', 'Trou noir'],
      ['supernova', 'Supernova'],
      ['supernova-remnant', 'Rémanent de supernova'],
      ['dwarf-planet', 'Planète naine'],
      ['asteroid', 'Astéroïde'],
      ['comet', 'Comète'],
      ['galaxy-cluster', 'Groupe de galaxies'],
      ['supercluster', 'Superamas'],
      ['cosmic-wall', 'Mur cosmique'],
      ['cosmic-filament', 'Filament cosmique'],
      ['cosmic-void', 'Vide cosmique'],
      ['cosmic-basin', 'Bassin cosmique'],
      ['cosmic-attractor', 'Attracteur'],
      ['cosmic-repeller', 'Répulseur'],
      ['universe', 'Univers'],
    ];

    component.query.set('mars');
    component.clear();

    expect(component.query()).toBe('');
    for (const [type, label] of labels) {
      expect(component.typeLabel(type)).toBe(label);
    }
    expect(component.typeLabel('region', ['constellation'])).toBe('Constellation');
    expect(component.typeLabel('region')).toBe('Région cosmique');
    expect(component.typeLabel('unknown' as SpaceObjectType)).toBe('Objet astronomique');
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

  it('ouvre un explorateur exoplanétaire, applique ses filtres et cible une découverte', () => {
    const fixture = TestBed.createComponent(UniverseSearchComponent);
    const component = fixture.componentInstance as unknown as UniverseSearchAccess;

    fixture.detectChanges();
    const catalogButton = fixture.nativeElement.querySelector(
      '.catalog-button',
    ) as HTMLButtonElement;

    expect(catalogButton.textContent?.replace(/\s+/gu, ' ').trim()).toBe('6 333');
    expect(fixture.nativeElement.querySelector('.discovery-panel')).toBeNull();

    component.toggleExplorer();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.discovery-panel')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Kepler-452 b');
    expect(discoverExoplanets).toHaveBeenCalledWith(
      {
        maxDistanceParsec: null,
        size: 'all',
        discoveryMethod: 'all',
        temperateOnly: false,
      },
      12,
    );

    component.updateDistanceFilter(selectEvent('500'));
    component.updateSizeFilter(selectEvent('super-earth'));
    component.updateMethodFilter(selectEvent('Transit'));
    component.toggleTemperateOnly();
    expect(component.discoveryResults()).toEqual([exoplanet]);
    expect(discoverExoplanets).toHaveBeenLastCalledWith(
      {
        maxDistanceParsec: 500,
        size: 'super-earth',
        discoveryMethod: 'Transit',
        temperateOnly: true,
      },
      12,
    );
    component.updateDistanceFilter(selectEvent('all'));
    component.updateSizeFilter(selectEvent('invalid'));
    expect(component.discoveryDistance(exoplanet)).toContain('551,7 pc');
    expect(component.discoveryRadius(exoplanet)).toContain('1,63 R⊕');
    expect(component.discoveryDistance({ ...exoplanet, metadata: {} })).toBe(
      'Distance non publiée',
    );
    expect(component.discoveryRadius({ ...exoplanet, metadata: {} })).toBeNull();

    component.choose(exoplanet);
    expect(component.explorerOpen()).toBe(false);
    expect(facade.focus).toHaveBeenCalledWith('kepler-452-b');
  });

  it('laisse les trois listes de l’explorateur recevoir les interactions du pointeur', () => {
    const fixture = TestBed.createComponent(UniverseSearchComponent);
    const component = fixture.componentInstance as unknown as UniverseSearchAccess;

    component.toggleExplorer();
    fixture.detectChanges();
    const filters = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.discovery-filters select',
      ) as NodeListOf<HTMLSelectElement>,
    );

    expect(filters).toHaveLength(3);
    for (const filter of filters) {
      const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true });

      filter.dispatchEvent(pointerDown);

      expect(pointerDown.defaultPrevented).toBe(false);
    }
  });
});

interface UniverseSearchAccess {
  readonly query: WritableSignal<string>;
  readonly active: WritableSignal<boolean>;
  readonly results: ReturnType<typeof signal<readonly SearchEntry[]>>;
  readonly explorerOpen: WritableSignal<boolean>;
  readonly discoveryResults: ReturnType<typeof signal<readonly SearchEntry[]>>;
  readonly resultSelected: { subscribe(listener: (result: SearchEntry) => void): unknown };
  updateQuery(event: Event): void;
  choose(result: SearchEntry): void;
  clear(): void;
  toggleExplorer(): void;
  updateDistanceFilter(event: Event): void;
  updateSizeFilter(event: Event): void;
  updateMethodFilter(event: Event): void;
  toggleTemperateOnly(): void;
  discoveryDistance(result: SearchEntry): string;
  discoveryRadius(result: SearchEntry): string | null;
  typeLabel(type: SpaceObjectType, keywords?: readonly string[]): string;
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

function selectEvent(value: string): Event {
  const select = document.createElement('select');
  const option = document.createElement('option');
  const event = new Event('change');

  option.value = value;
  select.append(option);
  select.value = value;
  Object.defineProperty(event, 'target', { value: select });

  return event;
}
