import { TestBed } from '@angular/core/testing';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import { EarthObserverSelection } from './earth-observer-selection';

describe('EarthObserverSelection', () => {
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

    selection.setLocation(null);

    expect(selection.location()).toBeNull();
  });
});
