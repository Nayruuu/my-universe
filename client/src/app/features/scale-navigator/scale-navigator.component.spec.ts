import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpaceObject } from '../../../data/models/universe.models';
import {
  NavigationScaleDefinition,
  NAVIGATION_SCALES,
} from '../../../engine/camera/navigation-scales';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { ScaleNavigatorComponent } from './scale-navigator.component';

describe('ScaleNavigatorComponent', () => {
  const lodLevel = signal(0);
  const targetId = signal<string | null>(null);
  const objects = signal<readonly SpaceObject[]>([]);
  const facade = {
    lodLevel,
    targetId,
    objects,
    focus: vi.fn(() => Promise.resolve()),
    viewScale: vi.fn(),
  };

  beforeEach(() => {
    lodLevel.set(0);
    targetId.set(null);
    objects.set([]);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [ScaleNavigatorComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('affiche le niveau courant et ouvre puis ferme le menu', () => {
    const component = createComponent();

    expect(component.scaleLabel()).toBe('Planétaire');
    component.toggleMenu();
    expect(component.menuOpen()).toBe(true);
    component.toggleMenu();
    expect(component.menuOpen()).toBe(false);

    lodLevel.set(4);
    expect(component.scaleLabel()).toBe('Groupe local');
    lodLevel.set(5);
    expect(component.scaleLabel()).toBe('Univers proche');
    lodLevel.set(6);
    expect(component.scaleLabel()).toBe('Réseau cosmique');
  });

  it('nomme la galaxie courante au niveau galactique', () => {
    const component = createComponent();

    lodLevel.set(3);
    targetId.set('andromeda');
    objects.set([
      {
        id: 'andromeda',
        name: 'Andromède',
        type: 'galaxy',
        referenceFrame: 'local-group',
        scientificConfidence: 'observed',
        visual: {
          visualRadius: 1,
          scaleMode: 'adaptive',
        },
        positionProvider: {
          type: 'static',
          position: [0, 0, 0],
          unit: 'kiloparsec',
        },
      },
    ]);

    expect(component.scaleLabel()).toBe('Andromède');

    targetId.set('missing');
    expect(component.scaleLabel()).toBe('Voie lactée');
  });

  it('conserve le contexte galactique pendant la plongée vers le voisinage stellaire', () => {
    const component = createComponent();

    lodLevel.set(2);
    targetId.set('milky-way');
    objects.set([
      {
        id: 'milky-way',
        name: 'Milky Way',
        type: 'galaxy',
        referenceFrame: 'local-group',
        scientificConfidence: 'simulated',
        visual: {
          visualRadius: 1,
          scaleMode: 'adaptive',
        },
        positionProvider: {
          type: 'static',
          position: [0, 0, 0],
          unit: 'kiloparsec',
        },
      },
    ]);

    expect(component.scaleLabel()).toBe('Voie lactée');
    expect(component.activeScaleLodLevel()).toBe(3);

    targetId.set('sun');

    expect(component.scaleLabel()).toBe('Voisinage stellaire');
    expect(component.activeScaleLodLevel()).toBe(2);
  });

  it('nomme explicitement le contexte compact lorsqu’un trou noir est ciblé', () => {
    const component = createComponent();

    targetId.set('sagittarius-a-star');
    objects.set([
      {
        id: 'sagittarius-a-star',
        name: 'Sagittarius A*',
        type: 'black-hole',
        referenceFrame: 'galactic',
        scientificConfidence: 'observed',
        visual: {
          visualRadius: 3,
          scaleMode: 'adaptive',
          blackHoleActivity: 'quiescent',
        },
        positionProvider: {
          type: 'static',
          position: [0, 0, 0],
          unit: 'kiloparsec',
        },
      },
    ]);

    expect(component.scaleLabel()).toBe('Trou noir');
  });

  it('ferme le menu avant de naviguer vers une échelle', () => {
    const component = createComponent();
    const scale = NAVIGATION_SCALES[2]!;

    component.toggleMenu();
    component.viewScale(scale);

    expect(component.menuOpen()).toBe(false);
    expect(facade.viewScale).toHaveBeenCalledWith(scale);
  });

  it('construit un fil d’Ariane cliquable depuis la hiérarchie scientifique', () => {
    const component = createComponent();

    targetId.set('earth');
    objects.set([
      scaleObject('cosmic-web', 'Univers observable'),
      scaleObject('milky-way', 'Voie lactée', 'cosmic-web'),
      scaleObject('sun', 'Soleil', 'milky-way'),
      scaleObject('earth', 'Terre', 'sun'),
    ]);

    expect(component.breadcrumbItems().map(({ name }) => name)).toEqual([
      'Réseau cosmique',
      'Voie lactée',
      'Soleil',
      'Terre',
    ]);
    component.navigateToObject('milky-way');
    expect(facade.focus).toHaveBeenCalledWith('milky-way');

    objects.set([scaleObject('earth', 'Terre', 'sun'), scaleObject('sun', 'Soleil', 'earth')]);
    expect(component.breadcrumbItems()).toHaveLength(2);
    targetId.set('missing');
    expect(component.breadcrumbItems()).toEqual([]);
  });

  it('rend le menu et distingue l’échelle active des autres', () => {
    const fixture = TestBed.createComponent(ScaleNavigatorComponent);
    const component = fixture.componentInstance as unknown as ScaleNavigatorAccess;

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.scale-menu')).toBeNull();

    component.toggleMenu();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.scale-menu button')).toHaveLength(
      NAVIGATION_SCALES.length,
    );
    expect(fixture.nativeElement.querySelectorAll('.scale-menu button.active')).toHaveLength(1);

    fixture.nativeElement
      .querySelector('.scale-switcher')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.menuOpen()).toBe(false);
  });
});

interface ScaleNavigatorAccess {
  readonly menuOpen: ReturnType<typeof signal<boolean>>;
  activeScaleLodLevel(): number;
  breadcrumbItems(): readonly { id: string; name: string }[];
  scaleLabel(): string;
  navigateToObject(objectId: string): void;
  toggleMenu(): void;
  viewScale(scale: NavigationScaleDefinition): void;
}

function scaleObject(id: string, name: string, parentId?: string): SpaceObject {
  return {
    id,
    name,
    type: id === 'earth' ? 'planet' : id === 'sun' ? 'star' : 'galaxy',
    ...(parentId ? { parentId } : {}),
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function createComponent(): ScaleNavigatorAccess {
  return TestBed.createComponent(ScaleNavigatorComponent)
    .componentInstance as unknown as ScaleNavigatorAccess;
}
