import type { EarthObserverViewState } from '../../../engine/camera/earth-observer-camera-control';
import type { SolarSystemSkyObservation } from '../../../engine/simulation/solar-system-sky';
import type { StellarObservation } from '../../../engine/simulation/stellar-observation';
import { projectEarthSkyBodies } from './earth-sky-body-projection';

const TARGET = observation(20, 350, true);

describe('projection des planètes dans le ciel terrestre', () => {
  it('projette seulement les astres levés présents dans le champ de vision', () => {
    const projected = projectEarthSkyBodies(
      [
        body('venus', observation(20, 350, true)),
        body('mars', observation(-4, 350, false)),
        body('jupiter', observation(20, 170, true)),
      ],
      TARGET,
      null,
      { width: 1_600, height: 900 },
    );

    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({
      id: 'venus',
      xPercent: expect.closeTo(50, 8),
      yPercent: expect.closeTo(50, 8),
    });
  });

  it('suit le regard, le zoom, les azimuts traversant le nord et borne le zénith', () => {
    const view: EarthObserverViewState = {
      active: true,
      pitchOffsetDegrees: 100,
      azimuthOffsetDegrees: 20,
      verticalFieldOfViewDegrees: 64,
    };
    const projected = projectEarthSkyBodies(
      [body('venus', observation(89.999, 330, true))],
      TARGET,
      view,
      { width: 0, height: 0 },
    );

    expect(projected).toEqual([
      expect.objectContaining({
        id: 'venus',
        xPercent: expect.any(Number),
        yPercent: expect.any(Number),
      }),
    ]);

    expect(
      projectEarthSkyBodies(
        [],
        observation(-89, 5, false),
        { ...view, pitchOffsetDegrees: -100 },
        {
          width: 800,
          height: 600,
        },
      ),
    ).toEqual([]);
  });

  it('projette les planètes dans le même sens azimutal que la caméra terrestre', () => {
    const projected = projectEarthSkyBodies(
      [body('venus', observation(20, 330, true)), body('jupiter', observation(20, 10, true))],
      TARGET,
      {
        active: true,
        pitchOffsetDegrees: 0,
        azimuthOffsetDegrees: 20,
        verticalFieldOfViewDegrees: 30,
      },
      { width: 800, height: 800 },
    );

    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({
      id: 'jupiter',
      xPercent: expect.closeTo(50, 8),
      yPercent: expect.closeTo(50, 8),
    });
  });

  it('conserve le cadrage horizontal absolu lorsque la cible stellaire dérive avec le temps', () => {
    const projected = projectEarthSkyBodies(
      [body('jupiter', observation(32, 42, true))],
      observation(-40, 200, false),
      {
        active: true,
        pitchOffsetDegrees: -70,
        azimuthOffsetDegrees: 130,
        verticalFieldOfViewDegrees: 64,
        centerAltitudeDegrees: 32,
        centerAzimuthDegrees: 42,
      },
      { width: 1_200, height: 800 },
    );

    expect(projected[0]).toMatchObject({
      xPercent: expect.closeTo(50, 8),
      yPercent: expect.closeTo(50, 8),
    });
  });
});

function body(
  id: SolarSystemSkyObservation['id'],
  skyObservation: StellarObservation,
): SolarSystemSkyObservation {
  return {
    id,
    fallbackName: id,
    color: '#fff',
    angularSizeClass: 'planet',
    assistedVisibility: false,
    lunarIllumination: null,
    observation: skyObservation,
  };
}

function observation(
  altitudeDegrees: number,
  azimuthDegrees: number,
  isAboveHorizon: boolean,
): StellarObservation {
  return {
    altitudeDegrees,
    geometricAltitudeDegrees: altitudeDegrees,
    atmosphericRefractionDegrees: 0,
    azimuthDegrees,
    compassDirection: 'north',
    isAboveHorizon,
  };
}
