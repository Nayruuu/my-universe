import { describe, expect, it } from 'vitest';
import { EphemerisBody, EphemerisOrigin } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { SolarSystemEphemerisProvider } from './position-providers';

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const J2000_MEAN_OBLIQUITY_RADIANS = (84_381.448 / 3_600) * (Math.PI / 180);

interface IcrfPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface HorizonsState {
  readonly julianDayUtc: number;
  readonly positionAu: IcrfPosition;
}

interface HorizonsBodyFixture {
  readonly origin: EphemerisOrigin;
  readonly maximumAbsoluteErrorKm: number;
  readonly maximumRelativeError: number;
  readonly states: readonly HorizonsState[];
}

const HORIZONS_QUERY = {
  source: 'NASA/JPL Horizons API',
  documentation: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
  generatedAt: '2026-08-14',
  ephemeris: 'DE441',
  targetIds: {
    mercury: 199,
    venus: 299,
    earth: 399,
    moon: 301,
    mars: 499,
    jupiter: 599,
    io: 501,
    europa: 502,
    ganymede: 503,
    callisto: 504,
    saturn: 699,
    uranus: 799,
    neptune: 899,
    pluto: 999,
  } satisfies Readonly<Record<EphemerisBody, number>>,
  centerIds: {
    sun: '500@10',
    earth: '500@399',
    jupiter: '500@599',
  } satisfies Readonly<Record<EphemerisOrigin, string>>,
  referenceSystem: 'ICRF',
  referencePlane: 'FRAME',
  correction: 'NONE',
  units: 'AU-D',
  timeType: 'UT',
} as const;

const HELIOCENTRIC_ERROR_BUDGET = {
  maximumAbsoluteErrorKm: 400_000,
  maximumRelativeError: 0.0001,
} as const;
const LUNAR_ERROR_BUDGET = {
  maximumAbsoluteErrorKm: 50,
  maximumRelativeError: 0.0001,
} as const;
const GALILEAN_ERROR_BUDGET = {
  maximumAbsoluteErrorKm: 1_000,
  maximumRelativeError: 0.001,
} as const;

const HORIZONS_FIXTURES = {
  mercury: heliocentricFixture([
    state(2_451_545, -0.1300777328324658, -0.4005973809166413, -0.2004929028644262),
    state(2_461_265.240206019, 0.1206205982785788, 0.2553209448769843, 0.1238928205905451),
    state(2_469_807.5, -0.1795372998125292, 0.2304472362004718, 0.141709720619871),
  ]),
  venus: heliocentricFixture([
    state(2_451_545, -0.7183017032914344, -0.04628798370945381, 0.02463442083102368),
    state(2_461_265.240206019, 0.06972610920801289, -0.6585190326405068, -0.3007265088693425),
    state(2_469_807.5, 0.1417979997166355, -0.6473438319980498, -0.3003057331472326),
  ]),
  earth: heliocentricFixture([
    state(2_451_545, -0.1771478822733411, 0.8874263692893543, 0.3847419657178373),
    state(2_461_265.240206019, 0.7724635249623061, -0.6016886443939802, -0.2608265445745495),
    state(2_469_807.5, -0.1716259552364023, 0.8884015819621505, 0.385049368215907),
  ]),
  moon: parentRelativeFixture('earth', LUNAR_ERROR_BUDGET, [
    state(2_451_545, -0.001949005522028226, -0.001783177670510671, -0.0005088429818904665),
    state(2_461_265.240206019, -0.001872047786977106, 0.001438933749217572, 0.0006651881362952251),
    state(2_469_807.5, 0.002403525571171275, 0.0006558639834622951, 0.000447426814601523),
  ]),
  mars: heliocentricFixture([
    state(2_451_545, 1.390716420540513, 0.001411479651675756, -0.03695547382036006),
    state(2_461_265.240206019, 0.7537682437713049, 1.180893951451151, 0.5213189588518669),
    state(2_469_807.5, -1.543227794711077, -0.4728634336624312, -0.1753632510697037),
  ]),
  jupiter: heliocentricFixture([
    state(2_451_545, 4.001174041917682, 2.736582798203076, 1.075514100963711),
    state(2_461_265.240206019, -3.19771719488534, 3.845349259709392, 1.726059960370857),
    state(2_469_807.5, -2.391051414087856, 4.265690729732121, 1.886423896779446),
  ]),
  io: parentRelativeFixture('jupiter', GALILEAN_ERROR_BUDGET, [
    state(2_451_545, 0.002669599658244782, 0.0007708572164167617, 0.0004121338967810792),
    state(2_461_265.240206019, -0.002170212728279776, 0.001634967494194383, 0.0007458281227764774),
    state(2_469_807.5, 0.002025921767215351, -0.001782782955659322, -0.0008182264319805621),
  ]),
  europa: parentRelativeFixture('jupiter', GALILEAN_ERROR_BUDGET, [
    state(2_451_545, -0.003748482607021814, -0.002140246648238047, -0.001058821871478328),
    state(2_461_265.240206019, 0.0007795928187602925, -0.003974958635154084, -0.001850875352638699),
    state(2_469_807.5, 0.00003312637446542022, 0.004012867378522964, 0.001937213749507383),
  ]),
  ganymede: parentRelativeFixture('jupiter', GALILEAN_ERROR_BUDGET, [
    state(2_451_545, -0.00548735367969472, -0.004114835565926371, -0.00203588784018916),
    state(2_461_265.240206019, 0.001293522509772729, 0.006334658880858968, 0.003059806301132464),
    state(2_469_807.5, 0.002963888175154299, 0.005850894217552065, 0.002842691166513096),
  ]),
  callisto: parentRelativeFixture('jupiter', GALILEAN_ERROR_BUDGET, [
    state(2_451_545, 0.002169560044385851, 0.01118830103309355, 0.005322484826388798),
    state(2_461_265.240206019, -0.007321566937195726, -0.009288129348697386, -0.004486143706921866),
    state(2_469_807.5, -0.01266256209409557, -0.0001785951808664355, -0.000270879019879293),
  ]),
  saturn: heliocentricFixture([
    state(2_451_545, 6.406407240068813, 6.174659165223042, 2.274771955830328),
    state(2_461_265.240206019, 9.321943248260922, 1.531199843198001, 0.2310020546485211),
    state(2_469_807.5, 4.766229819880683, -8.034660270411049, -3.524736105985613),
  ]),
  uranus: heliocentricFixture([
    state(2_451_545, 14.43185726551256, -12.506266172293, -5.681690128445922),
    state(2_461_265.240206019, 9.10410782199159, 15.79108946040466, 6.787187239475972),
    state(2_469_807.5, -17.82323817942907, 3.637690712692649, 1.845093934971147),
  ]),
  neptune: heliocentricFixture([
    state(2_451_545, 16.81204952165866, -22.98009945353556, -9.824427676493269),
    state(2_461_265.240206019, 29.84560617149874, 1.407409265939541, -0.1669446314970849),
    state(2_469_807.5, 17.39820261420731, 22.55873156106946, 8.800288179847996),
  ]),
  pluto: heliocentricFixture([
    state(2_451_545, -9.875345001880882, -27.97886255947921, -5.753680641600594),
    state(2_461_265.240206019, 19.83205397901462, -25.96493527398221, -14.07724240749249),
    state(2_469_807.5, 37.45495571588183, -10.21871833180162, -14.47384506578796),
  ]),
} as const satisfies Readonly<Record<EphemerisBody, HorizonsBodyFixture>>;

const HORIZONS_HELIOCENTRIC_CHILD_FIXTURES = {
  moon: [
    state(2_451_545, -0.1790968877953693, 0.8856431916188435, 0.3842331227359468),
    state(2_461_265.240206019, 0.7705914771753289, -0.6002497106447625, -0.2601613564382542),
    state(2_469_807.5, -0.1692224296652311, 0.8890574459456128, 0.3854967950305085),
  ],
  io: [
    state(2_451_545, 4.003843641575927, 2.737353655419493, 1.075926234860492),
    state(2_461_265.240206019, -3.19988740761362, 3.846984227203587, 1.726805788493633),
    state(2_469_807.5, -2.389025492320641, 4.263907946776461, 1.885605670347465),
  ],
  europa: [
    state(2_451_545, 3.997425559310661, 2.734442551554838, 1.074455279092232),
    state(2_461_265.240206019, -3.196937602066579, 3.841374301074238, 1.724209085018218),
    state(2_469_807.5, -2.391018287713391, 4.269703597110644, 1.888361110528953),
  ],
  ganymede: [
    state(2_451_545, 3.995686688237988, 2.732467962637149, 1.073478213123521),
    state(2_461_265.240206019, -3.196423672375567, 3.851683918590252, 1.729119766671989),
    state(2_469_807.5, -2.388087525912702, 4.271541623949673, 1.889266587945959),
  ],
  callisto: [
    state(2_451_545, 4.003343601962069, 2.74777109923617, 1.080836585790099),
    state(2_461_265.240206019, -3.205038761822535, 3.836061130360695, 1.721573816663935),
    state(2_469_807.5, -2.403713976181952, 4.265512134551255, 1.886153017759566),
  ],
} as const satisfies Readonly<
  Record<'moon' | 'io' | 'europa' | 'ganymede' | 'callisto', readonly HorizonsState[]>
>;

describe('SolarSystemEphemerisProvider against JPL Horizons DE441', () => {
  const coordinates = new CoordinateSystem();

  it.each(Object.entries(HORIZONS_FIXTURES) as [EphemerisBody, HorizonsBodyFixture][])(
    'keeps %s within its documented spatial error budget',
    (body, fixture) => {
      const provider = new SolarSystemEphemerisProvider(
        {
          type: 'ephemeris',
          body,
          origin: fixture.origin,
          orbitalPeriodDays: 1,
          orbitEpochJulianDay: 2_451_545,
        },
        coordinates,
        'solar-system',
      );

      const errors = fixture.states.map((reference) => {
        const actualAu = sceneToAstronomicalUnits(
          provider.getPositionAt({ julianDay: reference.julianDayUtc }),
          coordinates,
        );
        const expectedAu = icrfToSceneEcliptic(reference.positionAu);

        return positionError(actualAu, expectedAu, reference.julianDayUtc);
      });
      const maximumAbsoluteError = errors.reduce((maximum, current) =>
        current.errorKm > maximum.errorKm ? current : maximum,
      );
      const maximumRelativeError = errors.reduce((maximum, current) =>
        current.relativeError > maximum.relativeError ? current : maximum,
      );

      expect(
        maximumAbsoluteError.errorKm,
        `${body} at JD ${maximumAbsoluteError.julianDayUtc} differs from ${HORIZONS_QUERY.source} ${HORIZONS_QUERY.ephemeris} by ${maximumAbsoluteError.errorKm.toFixed(1)} km`,
      ).toBeLessThanOrEqual(fixture.maximumAbsoluteErrorKm);
      expect(
        maximumRelativeError.relativeError,
        `${body} at JD ${maximumRelativeError.julianDayUtc} differs from JPL Horizons by ${(maximumRelativeError.relativeError * 100).toFixed(5)}%`,
      ).toBeLessThanOrEqual(fixture.maximumRelativeError);
    },
  );

  it.each(
    Object.entries(HORIZONS_HELIOCENTRIC_CHILD_FIXTURES) as [
      keyof typeof HORIZONS_HELIOCENTRIC_CHILD_FIXTURES,
      readonly HorizonsState[],
    ][],
  )('composes the %s parent frame into a heliocentric world position', (body, states) => {
    const childFixture = HORIZONS_FIXTURES[body];
    const parentBody = childFixture.origin === 'earth' ? 'earth' : 'jupiter';
    const parentProvider = createProvider(parentBody, 'sun', coordinates);
    const childProvider = createProvider(body, childFixture.origin, coordinates);
    const errors = states.map((reference) => {
      const time = { julianDay: reference.julianDayUtc };
      const worldPosition = addVectors(
        sceneToAstronomicalUnits(parentProvider.getPositionAt(time), coordinates),
        sceneToAstronomicalUnits(childProvider.getPositionAt(time), coordinates),
      );

      return positionError(
        worldPosition,
        icrfToSceneEcliptic(reference.positionAu),
        reference.julianDayUtc,
      );
    });
    const maximumAbsoluteErrorKm = parentBody === 'earth' ? 20_000 : 50_000;

    expect(Math.max(...errors.map((error) => error.errorKm))).toBeLessThanOrEqual(
      maximumAbsoluteErrorKm,
    );
    expect(Math.max(...errors.map((error) => error.relativeError))).toBeLessThanOrEqual(0.0001);
  });
});

function state(julianDayUtc: number, x: number, y: number, z: number): HorizonsState {
  return { julianDayUtc, positionAu: { x, y, z } };
}

function heliocentricFixture(states: readonly HorizonsState[]): HorizonsBodyFixture {
  return { origin: 'sun', ...HELIOCENTRIC_ERROR_BUDGET, states };
}

function parentRelativeFixture(
  origin: EphemerisOrigin,
  errorBudget: Pick<HorizonsBodyFixture, 'maximumAbsoluteErrorKm' | 'maximumRelativeError'>,
  states: readonly HorizonsState[],
): HorizonsBodyFixture {
  return { origin, ...errorBudget, states };
}

function createProvider(
  body: EphemerisBody,
  origin: EphemerisOrigin,
  coordinates: CoordinateSystem,
): SolarSystemEphemerisProvider {
  return new SolarSystemEphemerisProvider(
    {
      type: 'ephemeris',
      body,
      origin,
      orbitalPeriodDays: 1,
      orbitEpochJulianDay: 2_451_545,
    },
    coordinates,
    'solar-system',
  );
}

function sceneToAstronomicalUnits(
  position: IcrfPosition,
  coordinates: CoordinateSystem,
): IcrfPosition {
  return {
    x: coordinates.sceneUnitsToAstronomicalUnits(position.x),
    y: coordinates.sceneUnitsToAstronomicalUnits(position.y),
    z: coordinates.sceneUnitsToAstronomicalUnits(position.z),
  };
}

function icrfToSceneEcliptic(position: IcrfPosition): IcrfPosition {
  const cosine = Math.cos(J2000_MEAN_OBLIQUITY_RADIANS);
  const sine = Math.sin(J2000_MEAN_OBLIQUITY_RADIANS);
  const eclipticY = cosine * position.y + sine * position.z;
  const eclipticZ = -sine * position.y + cosine * position.z;

  return { x: position.x, y: eclipticZ, z: -eclipticY };
}

function vectorDistance(left: IcrfPosition, right: IcrfPosition): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function addVectors(left: IcrfPosition, right: IcrfPosition): IcrfPosition {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function positionError(actual: IcrfPosition, expected: IcrfPosition, julianDayUtc: number) {
  const errorAu = vectorDistance(actual, expected);

  return {
    errorKm: errorAu * ASTRONOMICAL_UNIT_KM,
    relativeError: errorAu / Math.hypot(expected.x, expected.y, expected.z),
    julianDayUtc,
  };
}
