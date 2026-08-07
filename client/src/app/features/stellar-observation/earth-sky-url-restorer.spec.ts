import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SpaceObject } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { NavigationPresentationState } from '../../core/url/navigation-presentation-state';
import { EarthSkyJourney } from './earth-sky-journey';
import { EarthSkyUrlRestorer } from './earth-sky-url-restorer';

describe('EarthSkyUrlRestorer', () => {
  const ready = signal(false);
  const targetId = signal<string | null>('sirius');
  const selectedId = signal<string | null>(null);
  const viewMode = signal<'map' | 'planetarium'>('planetarium');
  const facade = {
    ready,
    targetId,
    selectedId,
    resolveObject: vi.fn(async () => sirius() as SpaceObject | null),
    setTemporalMode: vi.fn(),
  };
  const journey = {
    restore: vi.fn(async () => true),
  };
  const navigation = {
    viewMode,
    setViewMode: vi.fn((view: 'map' | 'planetarium') => viewMode.set(view)),
  };

  beforeEach(() => {
    ready.set(false);
    targetId.set('sirius');
    selectedId.set(null);
    viewMode.set('planetarium');
    facade.resolveObject.mockImplementation(async () => sirius());
    journey.restore.mockResolvedValue(true);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        EarthSkyUrlRestorer,
        { provide: UniverseEngineFacade, useValue: facade },
        { provide: EarthSkyJourney, useValue: journey },
        { provide: NavigationPresentationState, useValue: navigation },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('restaure une vue planétarium seulement lorsque le moteur est prêt', async () => {
    selectedId.set('betelgeuse');
    const restorer = TestBed.inject(EarthSkyUrlRestorer);

    restorer.start();
    TestBed.flushEffects();
    expect(facade.resolveObject).not.toHaveBeenCalled();

    ready.set(true);
    TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(facade.resolveObject).toHaveBeenCalledWith('sirius');
      expect(journey.restore).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sirius' }),
        'betelgeuse',
      );
    });
    expect(navigation.setViewMode).not.toHaveBeenCalled();
  });

  it('ne restaure ni une carte standard ni un restaurateur arrêté', () => {
    viewMode.set('map');
    const mapRestorer = TestBed.inject(EarthSkyUrlRestorer);

    mapRestorer.start();
    ready.set(true);
    TestBed.flushEffects();
    expect(facade.resolveObject).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    ready.set(false);
    viewMode.set('planetarium');
    TestBed.configureTestingModule({
      providers: [
        EarthSkyUrlRestorer,
        { provide: UniverseEngineFacade, useValue: facade },
        { provide: EarthSkyJourney, useValue: journey },
        { provide: NavigationPresentationState, useValue: navigation },
      ],
    });
    const stoppedRestorer = TestBed.inject(EarthSkyUrlRestorer);

    stoppedRestorer.start();
    stoppedRestorer.stop();
    ready.set(true);
    TestBed.flushEffects();

    expect(facade.resolveObject).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'sans cible',
      configure: () => targetId.set(null),
    },
    {
      name: 'avec une cible sans coordonnées équatoriales',
      configure: () => facade.resolveObject.mockResolvedValue(earth()),
    },
    {
      name: 'si le voyage échoue',
      configure: () => journey.restore.mockResolvedValue(false),
    },
  ])('revient proprement à la carte $name', async ({ configure }) => {
    configure();
    const restorer = TestBed.inject(EarthSkyUrlRestorer);

    restorer.start();
    ready.set(true);
    TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(navigation.setViewMode).toHaveBeenCalledWith('map');
      expect(facade.setTemporalMode).toHaveBeenCalledWith('state');
    });
  });
});

function sirius(): SpaceObject {
  return {
    id: 'sirius',
    name: 'Sirius',
    type: 'star',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 2, 3], unit: 'parsec' },
    metadata: {
      rightAscensionDegrees: 101.287_155,
      declinationDegrees: -16.716_116,
      skyCoordinateEpoch: 'J2000',
    },
  };
}

function earth(): SpaceObject {
  return {
    id: 'earth',
    name: 'Terre',
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 0, 0], unit: 'astronomical-unit' },
  };
}
