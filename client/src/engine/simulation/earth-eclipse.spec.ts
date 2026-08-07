import { EclipseKind } from 'astronomy-engine';
import { findEarthEclipsePage, findUpcomingEarthEclipses } from './earth-eclipse-catalog';
import { mapAstronomyEclipseKind } from './earth-eclipse';
import {
  calculateEarthObserverDirection,
  calculateEarthTextureOrientation,
} from './body-orientation';
import { calculateLunarEclipseAppearance } from './lunar-eclipse-calculator';
import {
  calculateSolarEclipseAppearance,
  calculateSolarEclipsePath,
  calculateSolarObserverDiscRatio,
} from './solar-eclipse-calculator';
import { dateToJulianDay, JULIAN_DAY_J2000, julianDayToDate } from './time-utils';

describe('éclipses terrestres', () => {
  it.each([
    [EclipseKind.Penumbral, 'penumbral'],
    [EclipseKind.Partial, 'partial'],
    [EclipseKind.Annular, 'annular'],
    [EclipseKind.Total, 'total'],
  ] as const)('traduit le type Astronomy Engine %s en %s', (kind, expected) => {
    expect(mapAstronomyEclipseKind(kind)).toBe(expected);
  });

  it('fusionne chronologiquement les prochains événements solaires et lunaires', () => {
    const events = findUpcomingEarthEclipses(
      { julianDay: dateToJulianDay(new Date('2026-07-28T00:00:00.000Z')) },
      4,
    );

    expect(
      events.map((event) => ({
        family: event.family,
        kind: event.kind,
        date: julianDayToDate(event.peak.julianDay).toISOString().slice(0, 10),
      })),
    ).toEqual([
      { family: 'solar', kind: 'total', date: '2026-08-12' },
      { family: 'lunar', kind: 'partial', date: '2026-08-28' },
      { family: 'solar', kind: 'annular', date: '2027-02-06' },
      { family: 'lunar', kind: 'penumbral', date: '2027-02-20' },
    ]);
    expect(events[0]?.latitude).not.toBeNull();
    expect(events[1]?.durationMinutes).toBeGreaterThan(190);
    expect(findUpcomingEarthEclipses({ julianDay: 2_461_250 }, 0)).toEqual([]);
  });

  it('parcourt les éclipses passées et futures sans inverser leur chronologie', () => {
    const reference = {
      julianDay: dateToJulianDay(new Date('2026-07-28T00:00:00.000Z')),
    };
    const previous = findEarthEclipsePage(reference, 6, 'past');
    const next = findEarthEclipsePage(reference, 6, 'future');

    expect(previous).toHaveLength(6);
    expect(next).toHaveLength(6);
    expect(previous.every((event) => event.peak.julianDay < reference.julianDay)).toBe(true);
    expect(next.every((event) => event.peak.julianDay >= reference.julianDay)).toBe(true);
    expect(previous.map((event) => event.peak.julianDay)).toEqual(
      [...previous].map((event) => event.peak.julianDay).sort((first, second) => first - second),
    );
    expect(julianDayToDate(previous.at(-1)!.peak.julianDay).toISOString().slice(0, 10)).toBe(
      '2026-03-03',
    );
    expect(next).toEqual(findUpcomingEarthEclipses(reference, 6));
    expect(findEarthEclipsePage(reference, 0, 'past')).toEqual([]);
  });

  it('conserve une éclipse solaire partielle sans centre et la durée d’une totalité lunaire', () => {
    const events = findUpcomingEarthEclipses({ julianDay: JULIAN_DAY_J2000 }, 2);
    const partialSolar = events.find(
      (event) => event.family === 'solar' && event.kind === 'partial',
    );
    const totalLunar = events.find((event) => event.family === 'lunar' && event.kind === 'total');

    expect(partialSolar).toMatchObject({
      obscuration: null,
      latitude: null,
      longitude: null,
    });
    expect(totalLunar?.durationMinutes).toBeGreaterThan(70);
    expect(totalLunar?.durationMinutes).toBeLessThan(90);
  });

  it.each([
    {
      label: 'totale',
      instant: '2026-03-03T11:34:52.000Z',
      expectedPhase: 'total',
    },
    {
      label: 'partielle',
      instant: '2026-08-28T04:14:04.000Z',
      expectedPhase: 'partial',
    },
    {
      label: 'pénombrale',
      instant: '2027-02-20T23:14:06.000Z',
      expectedPhase: 'penumbral',
    },
  ])('classe l’éclipse lunaire $label au maximum NASA', ({ instant, expectedPhase }) => {
    const appearance = calculateLunarEclipseAppearance({
      julianDay: dateToJulianDay(new Date(instant)),
    });

    expect(appearance.phase).toBe(expectedPhase);
    expect(appearance.umbraRadiusInMoonRadii).toBeGreaterThan(2);
    expect(appearance.penumbraRadiusInMoonRadii).toBeGreaterThan(appearance.umbraRadiusInMoonRadii);
  });

  it('n’active aucune ombre lunaire en dehors d’une éclipse', () => {
    const ordinaryDay = calculateLunarEclipseAppearance({
      julianDay: dateToJulianDay(new Date('2026-07-28T12:00:00.000Z')),
    });
    const solarEclipse = calculateLunarEclipseAppearance({
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:47.000Z')),
    });

    expect(ordinaryDay.phase).toBe('none');
    expect(solarEclipse.phase).toBe('none');
  });

  it.each([
    {
      label: 'totale du 12 août 2026',
      instant: '2026-08-12T17:45:53.800Z',
      expectedPhase: 'total',
    },
    {
      label: 'annulaire du 6 février 2027',
      instant: '2027-02-06T15:59:00.000Z',
      expectedPhase: 'annular',
    },
  ])('classe l’éclipse solaire $label', ({ instant, expectedPhase }) => {
    const appearance = calculateSolarEclipseAppearance({
      julianDay: dateToJulianDay(new Date(instant)),
    });

    expect(appearance.phase).toBe(expectedPhase);
    expect(vectorLength(appearance.shadowDirection)).toBeCloseTo(1, 8);
  });

  it('retrouve sur le géoïde le point central publié pour août 2026', () => {
    const peak = {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:46.794Z')),
    };
    const appearance = calculateSolarEclipseAppearance(peak);
    const path = calculateSolarEclipsePath(peak);

    expect(appearance.centralLatitude).toBeCloseTo(65.216, 3);
    expect(appearance.centralLongitude).toBeCloseTo(-25.249, 3);
    expect(
      dot(appearance.shadowDirection, normalized(appearance.sunPositionInEarthRadii)),
    ).toBeGreaterThan(0.25);
    expect(path.length).toBeGreaterThan(30);
    expect(path.every((point) => Math.abs(vectorLength(point) - 1) < 1e-8)).toBe(true);
  });

  it('aligne la texture terrestre avec les coordonnées géographiques de l’ombre', () => {
    const time = {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
    };
    const appearance = calculateSolarEclipseAppearance(time);
    const orientation = calculateEarthTextureOrientation(time);
    const localShadow = {
      x: dot(appearance.shadowDirection, orientation.xAxis),
      y: dot(appearance.shadowDirection, orientation.yAxis),
      z: dot(appearance.shadowDirection, orientation.zAxis),
    };
    const latitude = Math.asin(localShadow.y) * (180 / Math.PI);
    const longitude = Math.atan2(localShadow.z, localShadow.x) * (180 / Math.PI);

    // La texture est sphérique tandis que la latitude publiée est géodétique sur un ellipsoïde.
    expect(latitude).toBeCloseTo(appearance.centralLatitude ?? 0, 0);
    expect(longitude).toBeCloseTo(appearance.centralLongitude ?? 0, 6);
  });

  it('désactive l’ombre solaire hors alignement et produit un observateur terrestre unitaire', () => {
    const ordinaryTime = {
      julianDay: dateToJulianDay(new Date('2026-07-28T12:00:00.000Z')),
    };
    const appearance = calculateSolarEclipseAppearance(ordinaryTime);
    const observer = calculateEarthObserverDirection(ordinaryTime, 48.8566, 2.3522);

    expect(appearance.phase).toBe('none');
    expect(vectorLength(observer)).toBeCloseTo(1, 8);
  });

  it('conserve le rapport apparent totale/annulaire depuis leurs corridors respectifs', () => {
    const events = findUpcomingEarthEclipses(
      { julianDay: dateToJulianDay(new Date('2026-07-28T00:00:00.000Z')) },
      3,
    );
    const total = events.find((event) => event.family === 'solar' && event.kind === 'total');
    const annular = events.find((event) => event.family === 'solar' && event.kind === 'annular');

    expect(total?.latitude).not.toBeNull();
    expect(total?.longitude).not.toBeNull();
    expect(annular?.latitude).not.toBeNull();
    expect(annular?.longitude).not.toBeNull();
    expect(
      calculateSolarObserverDiscRatio(
        total?.peak ?? { julianDay: 0 },
        total?.latitude ?? 0,
        total?.longitude ?? 0,
      ),
    ).toBeGreaterThan(1);
    expect(
      calculateSolarObserverDiscRatio(
        annular?.peak ?? { julianDay: 0 },
        annular?.latitude ?? 0,
        annular?.longitude ?? 0,
      ),
    ).toBeLessThan(1);
  });
});

function vectorLength(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalized(vector: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  const length = vectorLength(vector);

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function dot(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}
