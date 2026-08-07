import frContent from '../i18n/locales/content.fr.json';
import { type EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import { UniverseEclipsePresenter } from './universe-eclipse-presentation';

describe('UniverseEclipsePresenter', () => {
  const presenter = new UniverseEclipsePresenter({
    getContent: () => frContent,
    getLocale: () => 'fr-FR',
    browserTimeZone: 'Europe/Paris',
    interpolate: (template, values) =>
      template.replace(/\{([a-zA-Z]+)\}/gu, (placeholder, key: string) =>
        values[key] === undefined ? placeholder : String(values[key]),
      ),
    formatNumber: (value, maximumFractionDigits) =>
      new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value),
  });

  it('construit puis rapproche l’événement instantané de l’événement actif', () => {
    const time = { julianDay: 2_461_265.239_583 };

    expect(
      presenter.createCurrentEvent(
        { phase: 'none', centralLatitude: null, centralLongitude: null },
        time,
      ),
    ).toBeNull();

    const current = presenter.createCurrentEvent(
      { phase: 'total', centralLatitude: 65.2, centralLongitude: -17.4 },
      time,
    )!;

    expect(current).toMatchObject({
      id: `solar-current-${Math.round(time.julianDay * 1_440)}`,
      family: 'solar',
      kind: 'total',
      scope: 'instant',
      peak: time,
      latitude: 65.2,
      longitude: -17.4,
    });
    expect(presenter.selectTimelineEvent(null, event({ scope: 'global' }))).toBeNull();

    const nearby = event({ peak: { julianDay: time.julianDay + 0.25 } });
    const distant = event({ peak: { julianDay: time.julianDay + 0.75 } });

    expect(presenter.selectTimelineEvent(current, nearby)).toBe(nearby);
    expect(presenter.selectTimelineEvent(current, distant)).toBe(current);
    expect(presenter.selectTimelineEvent(current, null)).toBe(current);
  });

  it('présente le lieu et le contexte global ou local', () => {
    expect(presenter.formatObserverLocation(null)).toBe('Point central');
    expect(
      presenter.formatObserverLocation(
        event({ latitude: null, longitude: null, observerName: null }),
      ),
    ).toBe('Point central calculé');
    expect(
      presenter.formatObserverLocation(
        event({ latitude: 48.9, longitude: 2.3, observerName: 'Paris' }),
      ),
    ).toBe('Paris · 48.9° N · 2.3° E');
    expect(
      presenter.formatObserverLocation(event({ latitude: -43, longitude: -2, observerName: null })),
    ).toBe('43.0° S · 2.0° O');

    expect(presenter.formatContextLabel(false, null)).toBe('Phénomène en cours');
    expect(
      presenter.formatContextLabel(false, event({ scope: 'local', observerName: 'Paris' })),
    ).toBe('Maximum local · Paris');
    expect(presenter.formatContextLabel(false, event({ scope: 'local', observerName: null }))).toBe(
      'Maximum local · lieu choisi',
    );
    expect(presenter.formatContextLabel(false, event({ scope: 'global' }))).toBe('Maximum mondial');
    expect(presenter.formatContextLabel(true, event({ scope: 'global' }))).toBe(
      'Observation locale',
    );
  });

  it('résume uniquement un maximum local avec ses données disponibles', () => {
    expect(presenter.formatLocalSummary(null)).toBeNull();
    expect(presenter.formatLocalSummary(event({ scope: 'global' }))).toBeNull();

    const unavailable = presenter.formatLocalSummary(
      event({
        scope: 'local',
        obscuration: null,
        observerTimeZone: null,
        sunAltitudeDegrees: null,
      }),
    );
    const measured = presenter.formatLocalSummary(
      event({
        scope: 'local',
        obscuration: 0.734,
        observerTimeZone: 'Europe/Paris',
        sunAltitudeDegrees: 12.4,
      }),
    );

    expect(unavailable).toContain('occultation indisponible');
    expect(unavailable).not.toContain('Soleil à');
    expect(measured).toContain('73,4 % occulté');
    expect(measured).toContain('Soleil à 12,4°');
  });

  it('présente les contacts locaux et signale ceux sous l’horizon', () => {
    expect(presenter.formatContactSummary(null)).toBeNull();
    expect(presenter.formatContactSummary(event({ scope: 'global' }))).toBeNull();

    const partial = presenter.formatContactSummary(
      event({
        scope: 'local',
        observerTimeZone: null,
        localContacts: contacts(),
      }),
    );
    const central = presenter.formatContactSummary(
      event({
        scope: 'local',
        observerTimeZone: 'UTC',
        localContacts: contacts({
          centralBegin: contact(2_461_265.2, 12),
          centralEnd: contact(2_461_265.21, 11),
        }),
      }),
    );

    expect(partial).toContain('C1');
    expect(partial).toContain('Max');
    expect(partial).toContain('C4');
    expect(partial).toContain('sous l’horizon');
    expect(partial).not.toContain('C2');
    expect(central).toContain('C2');
    expect(central).toContain('C3');
  });
});

function event(overrides: Partial<EarthEclipseEvent> = {}): EarthEclipseEvent {
  return {
    id: 'solar-test',
    family: 'solar',
    kind: 'total',
    scope: 'instant',
    peak: { julianDay: 2_461_265.239_583 },
    obscuration: null,
    durationMinutes: null,
    latitude: 65.2,
    longitude: -17.4,
    observerName: null,
    observerTimeZone: null,
    sunAltitudeDegrees: null,
    localContacts: null,
    ...overrides,
  };
}

function contacts(overrides: Partial<NonNullable<EarthEclipseEvent['localContacts']>> = {}) {
  return {
    partialBegin: contact(2_461_265.1, 18),
    centralBegin: null,
    maximum: contact(2_461_265.2, 12),
    centralEnd: null,
    partialEnd: contact(2_461_265.3, -1),
    ...overrides,
  };
}

function contact(julianDay: number, sunAltitudeDegrees: number) {
  return {
    time: { julianDay },
    sunAltitudeDegrees,
    aboveHorizon: sunAltitudeDegrees >= 0,
  };
}
