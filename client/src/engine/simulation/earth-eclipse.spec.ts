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
import {
  calculateSolarEclipseEventMap,
  createSolarEclipseEventMapRenderData,
} from './solar-eclipse-event-map';
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

  it('retrouve le maximum mondial publié par la NASA pour août 2026', () => {
    const peak = {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
    };
    const appearance = calculateSolarEclipseAppearance(peak);
    const path = calculateSolarEclipsePath(peak);

    // NASA GSFC: 65°13.5′ N, 25°13.7′ W at 17:45:53.8 UT.
    expect(Math.abs((appearance.centralLatitude ?? 0) - 65.225)).toBeLessThan(0.08);
    expect(Math.abs((appearance.centralLongitude ?? 0) - -25.228_333)).toBeLessThan(0.08);
    expect(
      dot(appearance.shadowDirection, normalized(appearance.sunPositionInEarthRadii)),
    ).toBeGreaterThan(0.25);
    expect(path.length).toBeGreaterThan(30);
    expect(path.every((point) => Math.abs(vectorLength(point) - 1) < 1e-8)).toBe(true);
  });

  it('reproduit le corridor NASA à 18:00 UTC avec ses deux limites physiques', () => {
    const peak = {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
    };
    const map = calculateSolarEclipseEventMap(peak);
    const sample = map.corridor.find(
      ({ time }) =>
        Math.abs(time.julianDay - dateToJulianDay(new Date('2026-08-12T18:00:00.000Z'))) <
        1 / 86_400,
    );

    expect(map.source).toBe(
      'Astronomy Engine geocentric ephemerides · validated against NASA GSFC path tables',
    );
    expect(sample).toBeDefined();
    // NASA table at 18:00 UT: central line 58°16.3′ N, 21°34.4′ W,
    // northern/southern limits 58°33.6′ N, 18°56.6′ W and 57°56.7′ N, 24°04.6′ W.
    expect(Math.abs(sample!.center.latitude - 58.271_667)).toBeLessThan(0.08);
    expect(Math.abs(sample!.center.longitude - -21.573_333)).toBeLessThan(0.08);
    expect(Math.abs(sample!.northernLimit.latitude - 58.56)).toBeLessThan(0.12);
    expect(Math.abs(sample!.northernLimit.longitude - -18.943_333)).toBeLessThan(0.18);
    expect(Math.abs(sample!.southernLimit.latitude - 57.945)).toBeLessThan(0.12);
    expect(Math.abs(sample!.southernLimit.longitude - -24.076_667)).toBeLessThan(0.18);
    expect(Math.abs(sample!.widthKm - 307)).toBeLessThan(12);
    expect(map.partialFootprints.length).toBeGreaterThan(12);
    expect(map.partialFootprints.every(({ boundary }) => boundary.length >= 24)).toBe(true);
  });

  it('prolonge le corridor total jusqu’en Espagne et couvre l’Europe documentée', () => {
    const peak = {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
    };
    const map = calculateSolarEclipseEventMap(peak);
    const renderData = createSolarEclipseEventMapRenderData(map);
    const spanishSample = map.corridor.find(
      ({ time }) =>
        Math.abs(time.julianDay - dateToJulianDay(new Date('2026-08-12T18:28:00.000Z'))) <
        1 / 86_400,
    );

    // NASA GSFC à 18:28 UTC : ligne centrale 43°22.3′ N, 6°11.3′ W.
    expect(spanishSample).toBeDefined();
    expect(Math.abs(spanishSample!.center.latitude - 43.371_667)).toBeLessThan(0.1);
    expect(Math.abs(spanishSample!.center.longitude - -6.188_333)).toBeLessThan(0.15);
    expect(spanishSample!.center.direction.z).toBeGreaterThan(0);

    // NASA indique une éclipse partielle à Paris, Londres, Berlin et Madrid.
    for (const city of [
      { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
      { name: 'Londres', latitude: 51.5074, longitude: -0.1278 },
      { name: 'Berlin', latitude: 52.52, longitude: 13.405 },
      { name: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
    ]) {
      expect(
        renderData.partialPolygons.some((polygon) => projectedPolygonContains(polygon, city)),
        city.name,
      ).toBe(true);
    }
  });

  it('cadre le maximum avec l’Europe sur l’hémisphère visible', () => {
    const peak = {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
    };
    const overview = calculateSolarEclipseAppearance(peak).shadowDirection;

    expect(vectorLength(overview)).toBeCloseTo(1, 8);
    expect(dot(overview, calculateEarthObserverDirection(peak, 48.8566, 2.3522))).toBeGreaterThan(
      0.72,
    );
    expect(dot(overview, calculateEarthObserverDirection(peak, 40.4168, -3.7038))).toBeGreaterThan(
      0.72,
    );
  });

  it('construit aussi un corridor annulaire et ses données de rendu', () => {
    const map = calculateSolarEclipseEventMap({
      julianDay: dateToJulianDay(new Date('2027-02-06T15:59:00.000Z')),
    });
    const renderData = createSolarEclipseEventMapRenderData(map);

    expect(map.corridor.length).toBeGreaterThan(10);
    expect(map.partialFootprints.length).toBeGreaterThan(10);
    expect(renderData.corridorIndices.length).toBe((map.corridor.length - 1) * 6);
    expect(renderData.centralLinePositions.length).toBe(map.corridor.length * 3);
    expect(renderData.minimumCorridorWidthKm).toBeGreaterThan(0);
    expect(renderData.maximumCorridorWidthKm).toBeGreaterThan(
      renderData.minimumCorridorWidthKm ?? 0,
    );
  });

  it('ne fabrique aucune carte d’éclipse à une date ordinaire', () => {
    const map = calculateSolarEclipseEventMap({
      julianDay: dateToJulianDay(new Date('2026-07-28T12:00:00.000Z')),
    });
    const renderData = createSolarEclipseEventMapRenderData(map);

    expect(map.corridor).toEqual([]);
    expect(map.partialFootprints).toEqual([]);
    expect(renderData).toMatchObject({
      partialPolygons: [],
      corridorPositions: [],
      corridorIndices: [],
      corridorLimitPositions: [],
      centralLinePositions: [],
      minimumCorridorWidthKm: null,
      maximumCorridorWidthKm: null,
    });
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
    const longitude = -Math.atan2(localShadow.z, localShadow.x) * (180 / Math.PI);

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

function projectedPolygonContains(
  polygon: readonly { x: number; y: number }[],
  location: { latitude: number; longitude: number },
): boolean {
  const projectedY = (90 - location.latitude) / 180;
  const baseX = (location.longitude + 180) / 360;

  return [-1, 0, 1].some((shift) => pointInPolygon(baseX + shift, projectedY, polygon));
}

function pointInPolygon(
  x: number,
  y: number,
  polygon: readonly { x: number; y: number }[],
): boolean {
  let inside = false;

  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const first = polygon[current]!;
    const second = polygon[previous]!;
    const intersects =
      first.y > y !== second.y > y &&
      x < ((second.x - first.x) * (y - first.y)) / (second.y - first.y) + first.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}
