import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SpaceObject } from '../../../data/models/universe.models';
import type { EarthObserverFraming } from '../../../engine/camera/earth-observer-camera-control';
import { DEFAULT_EARTH_OBSERVER_LOCATION } from '../../../engine/simulation/earth-observer-location';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { EarthObserverSelection } from './earth-observer-selection';
import { earthSkyEntryFraming } from './earth-sky-entry-framing';
import { EarthSkyJourney } from './earth-sky-journey';
import { EarthSkyViewState } from './earth-sky-view-state';

describe('EarthSkyJourney', () => {
  const cameraTransitioning = signal(false);
  const facade = {
    currentTime: signal({ julianDay: 2_461_269.122_916_667 }),
    prepareEarthObservation: vi.fn(
      async (
        objectId: string,
        framing?: EarthObserverFraming,
        selectedObjectId?: string | null,
      ) => {
        void objectId;
        void framing;
        void selectedObjectId;
      },
    ),
    isCameraTransitioning: vi.fn(() => cameraTransitioning()),
    selectObject: vi.fn(),
    setTemporalMode: vi.fn(),
    resolveObject: vi.fn(async (objectId: string) =>
      objectId === 'betelgeuse' ? betelgeuse() : null,
    ),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cameraTransitioning.set(false);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [EarthSkyJourney, { provide: UniverseEngineFacade, useValue: facade }],
    });
    TestBed.inject(EarthObserverSelection).setLocation(DEFAULT_EARTH_OBSERVER_LOCATION);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('voyage vers la Terre, restaure l’étoile sélectionnée puis ouvre le planétarium', async () => {
    cameraTransitioning.set(true);
    const journey = TestBed.inject(EarthSkyJourney);
    const state = TestBed.inject(EarthSkyViewState);
    const travelling = journey.start(sirius());

    await Promise.resolve();
    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'sirius',
      expect.objectContaining({
        initialPitchOffsetDegrees: expect.any(Number),
        pitchLimits: {
          minimumPitchOffsetDegrees: expect.any(Number),
          maximumPitchOffsetDegrees: expect.any(Number),
        },
        zenithDirection: expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          z: expect.any(Number),
        }),
      }),
    );
    const framing = facade.prepareEarthObservation.mock.calls[0]?.[1];
    const expectedFraming = earthSkyEntryFraming(
      sirius(),
      facade.currentTime(),
      DEFAULT_EARTH_OBSERVER_LOCATION,
    );

    expect(framing?.initialPitchOffsetDegrees).toBeCloseTo(
      expectedFraming.initialPitchOffsetDegrees,
      10,
    );
    expect(state.entryPitchOffsetDegrees()).toBeCloseTo(
      framing?.initialPitchOffsetDegrees ?? 0,
      10,
    );
    expect(state.phase()).toBe('travelling');

    await vi.advanceTimersByTimeAsync(2_400);
    expect(state.phase()).toBe('travelling');

    cameraTransitioning.set(false);
    await vi.advanceTimersByTimeAsync(50);
    await travelling;

    expect(facade.selectObject).toHaveBeenCalledWith('sirius');
    expect(facade.setTemporalMode).toHaveBeenCalledWith('observable');
    expect(state.activeTargetId()).toBe('sirius');
    expect(state.phase()).toBe('open');
  });

  it('borne le voyage si la caméra ne publie jamais sa fin', async () => {
    cameraTransitioning.set(true);
    const journey = TestBed.inject(EarthSkyJourney);
    const travelling = journey.start(sirius());

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_800);
    await travelling;

    expect(facade.selectObject).toHaveBeenCalledWith('sirius');
    expect(TestBed.inject(EarthSkyViewState).phase()).toBe('open');
  });

  it('restaure le planétarium sans inventer une sélection ni un observateur absents', async () => {
    TestBed.inject(EarthObserverSelection).setLocation(null);
    const journey = TestBed.inject(EarthSkyJourney);
    const restoring = journey.restore(sirius(), null);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_400);
    await expect(restoring).resolves.toBe(true);

    expect(facade.prepareEarthObservation).toHaveBeenCalledWith('sirius', undefined, null);
    expect(facade.selectObject).toHaveBeenCalledWith(null);
    expect(facade.setTemporalMode).toHaveBeenCalledWith('observable');
    expect(TestBed.inject(EarthSkyViewState).phase()).toBe('open');
  });

  it('recentre une autre étoile sans rejouer le voyage vers la Terre', async () => {
    const journey = TestBed.inject(EarthSkyJourney);
    const state = TestBed.inject(EarthSkyViewState);
    const target = betelgeuse();

    state.open('sirius', 'Sirius', sirius(), 12);
    await journey.retarget(target);

    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'betelgeuse',
      expect.objectContaining({
        initialPitchOffsetDegrees: expect.any(Number),
        pitchLimits: {
          minimumPitchOffsetDegrees: expect.any(Number),
          maximumPitchOffsetDegrees: expect.any(Number),
        },
      }),
    );
    expect(facade.selectObject).toHaveBeenCalledWith('betelgeuse');
    expect(facade.setTemporalMode).toHaveBeenCalledWith('observable');
    expect(state.activeTargetId()).toBe('betelgeuse');
    expect(state.activeTargetName()).toBe('Bételgeuse');
    expect(state.activeTarget()).toBe(target);
    expect(state.entryPitchOffsetDegrees()).toBeCloseTo(
      facade.prepareEarthObservation.mock.calls.at(-1)?.[1]?.initialPitchOffsetDegrees ?? 0,
      10,
    );
    expect(state.phase()).toBe('open');
  });

  it('résout une cible du catalogue avant de la recentrer dans le ciel terrestre', async () => {
    const journey = TestBed.inject(EarthSkyJourney);

    TestBed.inject(EarthSkyViewState).open('sirius', 'Sirius', sirius());

    await expect(journey.retargetById('betelgeuse')).resolves.toBe(true);
    expect(facade.resolveObject).toHaveBeenCalledWith('betelgeuse');
    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'betelgeuse',
      expect.objectContaining({ initialPitchOffsetDegrees: expect.any(Number) }),
    );

    await expect(journey.retargetById('missing')).resolves.toBe(false);
    expect(facade.prepareEarthObservation).toHaveBeenCalledTimes(1);
  });

  it('conserve un horizon visible lors d’un recentrage lancé par la recherche', async () => {
    const journey = TestBed.inject(EarthSkyJourney);

    TestBed.inject(EarthSkyViewState).open('sirius', 'Sirius', sirius());
    await journey.retargetById('betelgeuse', 72);
    const framing = facade.prepareEarthObservation.mock.calls.at(-1)?.[1];
    const fieldOfView = framing?.verticalFieldOfViewDegrees ?? 82;
    const centerAltitude = framing?.initialCenterAltitudeDegrees ?? 0;

    expect(50 + (centerAltitude / fieldOfView) * 100).toBeCloseTo(72, 5);
  });

  it('restaure la direction précédente si le recentrage terrestre échoue', async () => {
    const journey = TestBed.inject(EarthSkyJourney);
    const state = TestBed.inject(EarthSkyViewState);
    const initialTarget = sirius();

    state.open(initialTarget.id, initialTarget.name, initialTarget, 12);
    facade.prepareEarthObservation.mockRejectedValueOnce(new Error('navigation unavailable'));
    await journey.retarget(betelgeuse());

    expect(state.activeTargetId()).toBe('sirius');
    expect(state.activeTargetName()).toBe('Sirius');
    expect(state.activeTarget()).toBe(initialTarget);
    expect(state.entryPitchOffsetDegrees()).toBe(12);
    expect(state.phase()).toBe('open');
    expect(facade.setTemporalMode).not.toHaveBeenCalled();
    expect(facade.selectObject).not.toHaveBeenCalled();
  });

  it('reste fermé si un recentrage sans cible précédente ni observateur échoue', async () => {
    const journey = TestBed.inject(EarthSkyJourney);
    const state = TestBed.inject(EarthSkyViewState);

    state.close();
    TestBed.inject(EarthObserverSelection).setLocation(null);
    facade.prepareEarthObservation.mockRejectedValueOnce(new Error('navigation unavailable'));
    await journey.retarget(betelgeuse());

    expect(facade.prepareEarthObservation).toHaveBeenCalledWith('betelgeuse', undefined);
    expect(state.activeTargetId()).toBeNull();
    expect(state.phase()).toBe('closed');
  });

  it('n’ouvre rien lorsqu’un voyage est annulé ou que le focus échoue', async () => {
    const journey = TestBed.inject(EarthSkyJourney);
    const state = TestBed.inject(EarthSkyViewState);
    const cancelled = journey.start(sirius());

    state.close();
    await Promise.resolve();
    await cancelled;

    expect(facade.selectObject).not.toHaveBeenCalled();
    expect(facade.setTemporalMode).not.toHaveBeenCalled();

    TestBed.inject(EarthObserverSelection).setLocation(null);
    facade.prepareEarthObservation.mockRejectedValueOnce(new Error('navigation unavailable'));
    const failed = journey.start(sirius());

    await failed;
    expect(facade.prepareEarthObservation).toHaveBeenLastCalledWith('sirius', undefined);
    expect(state.phase()).toBe('closed');
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

function betelgeuse(): SpaceObject {
  return {
    ...sirius(),
    id: 'betelgeuse',
    name: 'Bételgeuse',
    metadata: {
      rightAscensionDegrees: 88.792_939,
      declinationDegrees: 7.407_064,
      skyCoordinateEpoch: 'J2000',
    },
  };
}
