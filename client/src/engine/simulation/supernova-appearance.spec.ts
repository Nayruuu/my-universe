import {
  calculateSupernovaAppearance,
  type SupernovaTemporalProfile,
} from './supernova-appearance';

describe('calculateSupernovaAppearance', () => {
  const documentedEvent: SupernovaTemporalProfile = {
    peakJulianDay: 2_446_849.5,
    riseDays: 18,
    decayDays: 420,
    shellFormationDays: 45,
    referenceJulianDay: 2_461_158.5,
  };

  it('ne montre ni explosion ni rémanent avant un événement historique documenté', () => {
    expect(
      calculateSupernovaAppearance(
        { julianDay: documentedEvent.peakJulianDay! - documentedEvent.riseDays - 1 },
        documentedEvent,
      ),
    ).toEqual({
      phase: 'pre-event',
      flashIntensity: 0,
      shellOpacity: 0,
      shellScale: 0,
    });
  });

  it('fait croître la luminosité pendant la montée sans créer prématurément la coquille', () => {
    const appearance = calculateSupernovaAppearance(
      { julianDay: documentedEvent.peakJulianDay! - documentedEvent.riseDays / 2 },
      documentedEvent,
    );

    expect(appearance.phase).toBe('rising');
    expect(appearance.flashIntensity).toBeCloseTo(0.5, 8);
    expect(appearance.shellOpacity).toBe(0);
    expect(appearance.shellScale).toBe(0);
  });

  it('atteint exactement son maximum à la date de référence', () => {
    expect(
      calculateSupernovaAppearance({ julianDay: documentedEvent.peakJulianDay! }, documentedEvent),
    ).toEqual({
      phase: 'peak',
      flashIntensity: 1,
      shellOpacity: 0,
      shellScale: 0,
    });
  });

  it('décroît après le maximum puis laisse apparaître un rémanent en expansion', () => {
    const fading = calculateSupernovaAppearance(
      { julianDay: documentedEvent.peakJulianDay! + 60 },
      documentedEvent,
    );
    const remnant = calculateSupernovaAppearance(
      { julianDay: documentedEvent.referenceJulianDay },
      documentedEvent,
    );
    const future = calculateSupernovaAppearance(
      {
        julianDay:
          documentedEvent.peakJulianDay! +
          (documentedEvent.referenceJulianDay - documentedEvent.peakJulianDay!) * 4,
      },
      documentedEvent,
    );

    expect(fading.phase).toBe('fading');
    expect(fading.flashIntensity).toBeGreaterThan(0);
    expect(fading.flashIntensity).toBeLessThan(1);
    expect(fading.shellOpacity).toBeGreaterThan(0);
    expect(fading.shellScale).toBeGreaterThan(0);
    expect(remnant.phase).toBe('remnant');
    expect(remnant.flashIntensity).toBe(0);
    expect(remnant.shellOpacity).toBe(1);
    expect(remnant.shellScale).toBeCloseTo(1, 8);
    expect(future.shellScale).toBe(1.6);
  });

  it('affiche un rémanent observé sans inventer une date d’explosion précise', () => {
    expect(
      calculateSupernovaAppearance(
        { julianDay: 2_461_158.5 },
        {
          peakJulianDay: null,
          riseDays: 0,
          decayDays: 0,
          shellFormationDays: 0,
          referenceJulianDay: 2_461_158.5,
        },
      ),
    ).toEqual({
      phase: 'remnant',
      flashIntensity: 0,
      shellOpacity: 1,
      shellScale: 1,
    });
  });

  it('normalise les paramètres non physiques sans produire de valeurs invalides', () => {
    const appearance = calculateSupernovaAppearance(
      { julianDay: 120 },
      {
        peakJulianDay: 100,
        riseDays: -2,
        decayDays: 0,
        shellFormationDays: -1,
        referenceJulianDay: 90,
      },
    );

    expect(appearance.phase).toBe('remnant');
    expect(appearance.flashIntensity).toBe(0);
    expect(appearance.shellOpacity).toBe(1);
    expect(appearance.shellScale).toBe(1.6);
  });
});
