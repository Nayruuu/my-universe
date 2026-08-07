import { TestBed } from '@angular/core/testing';
import { NavigationState } from '../../../data/models/universe.models';
import { dateToJulianDay } from '../../../engine/simulation/time-utils';
import {
  NavigationUrlService,
  parseNavigationState,
  serializeNavigationState,
} from './navigation-url.service';

describe('URL partageable', () => {
  const state: NavigationState = {
    targetId: 'earth',
    selectedId: 'moon',
    julianDay: dateToJulianDay(new Date('2026-07-27T10:00:00.000Z')),
    zoom: 4.2,
    mode: 'state',
    quality: 'medium',
    labelDensity: 'dense',
    showOrbits: true,
    showConstellations: false,
    showLabels: false,
    view: 'planetarium',
    observerLocationId: 'geonames-1850147',
  };

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    TestBed.configureTestingModule({ providers: [NavigationUrlService] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('sérialise l’état essentiel dans la query string', () => {
    const url = serializeNavigationState(state, new URL('https://example.test/?debug=true'));

    expect(url.searchParams.get('target')).toBe('earth');
    expect(url.searchParams.get('selected')).toBe('moon');
    expect(url.searchParams.get('zoom')).toBe('4.20');
    expect(url.searchParams.get('labels')).toBe('0');
    expect(url.searchParams.get('density')).toBe('dense');
    expect(url.searchParams.get('constellations')).toBe('0');
    expect(url.searchParams.get('view')).toBe('planetarium');
    expect(url.searchParams.get('observer')).toBe('geonames-1850147');
    expect(url.searchParams.get('debug')).toBe('true');
  });

  it('désérialise un état sérialisé', () => {
    const url = serializeNavigationState(state, new URL('https://example.test/'));
    const parsed = parseNavigationState(url);

    expect(parsed.targetId).toBe(state.targetId);
    expect(parsed.selectedId).toBe(state.selectedId);
    expect(parsed.julianDay).toBeCloseTo(state.julianDay, 6);
    expect(parsed.quality).toBe('medium');
    expect(parsed.labelDensity).toBe('dense');
    expect(parsed.view).toBe('planetarium');
    expect(parsed.observerLocationId).toBe('geonames-1850147');
  });

  it('accepte directement un jour julien', () => {
    const parsed = parseNavigationState(
      new URL('https://example.test/?time=2451545&mode=observable'),
    );

    expect(parsed.julianDay).toBe(2_451_545);
    expect(parsed.mode).toBe('observable');
  });

  it('lit l’URL courante et crée une URL de partage', () => {
    window.history.replaceState(null, '', '/?target=mars&quality=high&density=minimal');
    const service = TestBed.inject(NavigationUrlService);

    expect(service.read()).toMatchObject({
      targetId: 'mars',
      quality: 'high',
      labelDensity: 'minimal',
    });
    expect(new URL(service.createShareUrl(state)).searchParams.get('target')).toBe('earth');
  });

  it('ignore les valeurs invalides et distingue les options absentes, vides et désactivées', () => {
    expect(parseNavigationState(new URL('https://example.test/'))).toEqual({});
    expect(
      parseNavigationState(
        new URL(
          'https://example.test/?target=&selected=&time=incorrect&zoom=0&mode=other&quality=ultra&density=packed&orbits=0&constellations=1&labels=1&view=other&observer=',
        ),
      ),
    ).toEqual({
      targetId: null,
      selectedId: null,
      showOrbits: false,
      showConstellations: true,
      showLabels: true,
      observerLocationId: null,
    });
    expect(
      parseNavigationState(
        new URL(
          'https://example.test/?time=2026-08-12T17:45:00Z&zoom=Infinity&mode=state&quality=low&view=map',
        ),
      ),
    ).toMatchObject({ mode: 'state', quality: 'low', view: 'map' });
    expect(
      parseNavigationState(
        new URL('https://example.test/?quality=high&density=balanced&orbits=1&labels=0'),
      ),
    ).toMatchObject({
      quality: 'high',
      labelDensity: 'balanced',
      showOrbits: true,
      showLabels: false,
    });
  });

  it('supprime les cibles nulles et sérialise un temps hors domaine Date', () => {
    const url = serializeNavigationState(
      {
        ...state,
        targetId: null,
        selectedId: null,
        julianDay: Number.NaN,
        showOrbits: false,
        showConstellations: true,
        showLabels: true,
      },
      new URL('https://example.test/?target=earth&selected=moon'),
    );

    expect(url.searchParams.has('target')).toBe(false);
    expect(url.searchParams.has('selected')).toBe(false);
    expect(url.searchParams.get('time')).toBe('NaN');
    expect(url.searchParams.get('orbits')).toBe('0');
    expect(url.searchParams.get('constellations')).toBe('1');
    expect(url.searchParams.get('labels')).toBe('1');
  });

  it('écrit périodiquement même lorsque les mises à jour sont continues', () => {
    vi.useFakeTimers();
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => undefined);
    const service = TestBed.inject(NavigationUrlService);

    try {
      for (let index = 0; index < 9; index += 1) {
        service.scheduleWrite({ ...state, zoom: index + 1 });
        vi.advanceTimersByTime(120);
      }

      expect(replaceState).toHaveBeenCalledTimes(1);
      const writtenUrl = replaceState.mock.calls[0]?.[2];

      expect(new URL(String(writtenUrl)).searchParams.get('zoom')).toBe('9.00');
    } finally {
      replaceState.mockRestore();
      vi.useRealTimers();
    }
  });

  it('conserve la vue la plus récente malgré une écriture de caméra déjà planifiée', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(NavigationUrlService);

    try {
      service.scheduleWrite({ ...state, view: 'map', observerLocationId: 'paris' });
      service.updateViewContext('planetarium', 'geonames-1850147');

      expect(new URL(window.location.href).searchParams.get('view')).toBe('planetarium');
      expect(new URL(window.location.href).searchParams.get('observer')).toBe('geonames-1850147');

      vi.advanceTimersByTime(350);

      expect(new URL(window.location.href).searchParams.get('view')).toBe('planetarium');
      expect(new URL(window.location.href).searchParams.get('observer')).toBe('geonames-1850147');
      expect(
        new URL(service.createShareUrl({ ...state, view: 'map' })).searchParams.get('view'),
      ).toBe('planetarium');
    } finally {
      vi.useRealTimers();
    }
  });

  it('préserve les paramètres de vue si un ancien état ne les fournit pas', () => {
    const legacyState: NavigationState = { ...state };

    delete legacyState.view;
    delete legacyState.observerLocationId;
    const url = serializeNavigationState(
      legacyState,
      new URL('https://example.test/?view=planetarium&observer=paris'),
    );

    expect(url.searchParams.get('view')).toBe('planetarium');
    expect(url.searchParams.get('observer')).toBe('paris');
  });

  it('annule une écriture différée déjà vidée et accepte un flush sans état', () => {
    vi.useFakeTimers();
    const replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => undefined);
    const service = TestBed.inject(NavigationUrlService) as unknown as NavigationUrlAccess;

    try {
      service.flushScheduledWrite();
      expect(replaceState).not.toHaveBeenCalled();

      service.scheduleWrite(state);
      vi.advanceTimersByTime(350);
      service.flushScheduledWrite();

      expect(replaceState).toHaveBeenCalledOnce();
    } finally {
      replaceState.mockRestore();
      vi.useRealTimers();
    }
  });
});

interface NavigationUrlAccess {
  scheduleWrite(state: NavigationState): void;
  flushScheduledWrite(): void;
}
