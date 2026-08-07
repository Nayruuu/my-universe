import { lunarPhasePresentation } from './lunar-phase-presentation';

describe('présentation de la phase lunaire', () => {
  it('n’ajoute aucune phase aux autres astres', () => {
    expect(lunarPhasePresentation(null)).toEqual({
      shape: 'none',
      terminatorScale: 0,
      waxing: 'false',
    });
  });

  it('dessine les croissants croissants et décroissants', () => {
    expect(lunarPhasePresentation({ illuminatedFraction: 0.18, waxing: true })).toEqual({
      shape: 'crescent',
      terminatorScale: expect.closeTo(0.64, 8),
      waxing: 'true',
    });
    expect(lunarPhasePresentation({ illuminatedFraction: 0.25, waxing: false })).toEqual({
      shape: 'crescent',
      terminatorScale: 0.5,
      waxing: 'false',
    });
  });

  it('dessine les quartiers et les phases gibbeuses dans les bornes physiques', () => {
    expect(lunarPhasePresentation({ illuminatedFraction: 0.5, waxing: true })).toEqual({
      shape: 'gibbous',
      terminatorScale: 0,
      waxing: 'true',
    });
    expect(lunarPhasePresentation({ illuminatedFraction: 0.75, waxing: false })).toEqual({
      shape: 'gibbous',
      terminatorScale: 0.5,
      waxing: 'false',
    });
    expect(lunarPhasePresentation({ illuminatedFraction: -1, waxing: true }).terminatorScale).toBe(
      1,
    );
    expect(lunarPhasePresentation({ illuminatedFraction: 2, waxing: false }).terminatorScale).toBe(
      1,
    );
  });
});
