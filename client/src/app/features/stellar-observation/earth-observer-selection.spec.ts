import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import { NavigationPresentationState } from '../../core/url/navigation-presentation-state';
import { EarthObserverSelection, resolveEarthObserverLocation } from './earth-observer-selection';

describe('EarthObserverSelection', () => {
  const observerLocationId = signal<string | null>(null);
  const navigation = {
    observerLocationId,
    setObserverLocationId: vi.fn((locationId: string | null) => observerLocationId.set(locationId)),
  };

  beforeEach(() => {
    observerLocationId.set(null);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: NavigationPresentationState, useValue: navigation }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('part de Paris puis partage le lieu choisi avec la vue nocturne', () => {
    const selection = TestBed.inject(EarthObserverSelection);
    const custom: EarthObserverLocation = {
      id: 'custom',
      name: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      timeZone: 'Europe/London',
    };

    expect(selection.location()?.id).toBe('paris');

    selection.setLocation(custom);

    expect(selection.location()).toBe(custom);
    expect(navigation.setObserverLocationId).toHaveBeenLastCalledWith('custom');

    selection.synchronizeNavigation();
    expect(navigation.setObserverLocationId).toHaveBeenLastCalledWith('custom');

    selection.setLocation(null);

    expect(selection.location()).toBeNull();
    expect(navigation.setObserverLocationId).toHaveBeenLastCalledWith(null);
  });

  it('restaure une ville du catalogue et des coordonnées personnalisées', () => {
    observerLocationId.set('geonames-1850147');
    const selection = TestBed.inject(EarthObserverSelection);

    expect(selection.location()?.name).toBe('Tokyo');
    expect(resolveEarthObserverLocation('coordinates--33.868800-151.209300')).toMatchObject({
      id: 'coordinates--33.868800-151.209300',
      latitude: -33.8688,
      longitude: 151.2093,
    });
  });

  it('retombe sur Paris pour un identifiant inconnu ou des coordonnées invalides', () => {
    expect(resolveEarthObserverLocation('unknown').id).toBe('paris');
    expect(resolveEarthObserverLocation('coordinates-91.000000-2.000000').id).toBe('paris');
  });
});
