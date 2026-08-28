import type { EarthObserverViewState } from '../../../engine/camera/earth-observer-camera-control';
import type { SolarSystemSkyObservation } from '../../../engine/simulation/solar-system-sky';
import type { StellarObservation } from '../../../engine/simulation/stellar-observation';
import {
  calculateAngularDiameterPixels,
  layoutEarthSkyBodyLabels,
  projectEarthSkyBodies,
  type EarthSkyBodyLabelLayout,
  type ProjectedEarthSkyBody,
} from './earth-sky-body-projection';

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
      apparentDiameterPixels: expect.any(Number),
      displayDiameterPixels: 7,
      resolvedAppearance: false,
      xPercent: expect.closeTo(50, 8),
      yPercent: expect.closeTo(50, 8),
    });
  });

  it('agrandit progressivement un disque planétaire en conservant son diamètre calculé', () => {
    const wide = projectEarthSkyBodies(
      [body('jupiter', observation(20, 350, true), 0.014)],
      TARGET,
      null,
      { width: 1_600, height: 900 },
    )[0]!;
    const telescopic = projectEarthSkyBodies(
      [body('jupiter', observation(20, 350, true), 0.014)],
      TARGET,
      {
        active: true,
        pitchOffsetDegrees: 0,
        azimuthOffsetDegrees: 0,
        verticalFieldOfViewDegrees: 2,
      },
      { width: 1_600, height: 900 },
    )[0]!;

    expect(wide.apparentDiameterPixels).toBeCloseTo(
      calculateAngularDiameterPixels(0.014, 82, 900),
      8,
    );
    expect(telescopic.apparentDiameterPixels).toBeGreaterThan(wide.apparentDiameterPixels * 30);
    expect(telescopic.displayDiameterPixels).toBeGreaterThanOrEqual(32);
    expect(telescopic.resolvedAppearance).toBe(true);
    expect(telescopic.displayScaleMode).toBe(
      'calculated-angular-size-with-illustrative-readability-floor',
    );
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

  it('répartit les noms proches sans déplacer les ancres astronomiques', () => {
    const projected = projectEarthSkyBodies(
      [
        body('satellite-ordinaire', TARGET),
        { ...body('lune-prioritaire', TARGET), skyObjectKind: 'moon' },
        { ...body('planete-prioritaire', TARGET), skyObjectKind: 'planet' },
        { ...body('satellite-selectionne', TARGET), skyObjectKind: 'satellite' },
        { ...body('autre-satellite', TARGET), skyObjectKind: 'satellite' },
      ],
      TARGET,
      null,
      { width: 800, height: 600 },
    ).map((projectedBody) => ({ ...projectedBody, name: projectedBody.fallbackName }));
    const laidOut = layoutEarthSkyBodyLabels(projected, { width: 800, height: 600 }, [
      null,
      undefined,
      'satellite-selectionne',
    ]);

    expect(laidOut).toHaveLength(projected.length);
    expect(laidOut.every(({ labelVisible }) => labelVisible)).toBe(true);
    expect(laidOut.find(({ id }) => id === 'satellite-selectionne')).toMatchObject({
      labelPlacement: 'below',
      labelVisible: true,
    });
    expect(laidOut.find(({ id }) => id === 'lune-prioritaire')).toMatchObject({
      labelPlacement: 'above',
      labelVisible: true,
    });
    laidOut.forEach((bodyLayout, index) => {
      expect(bodyLayout.xPercent).toBe(projected[index]!.xPercent);
      expect(bodyLayout.yPercent).toBe(projected[index]!.yPercent);
    });
    expectLabelsNotToOverlap(laidOut);
  });

  it('cherche un emplacement intérieur pour un nom près du bord de l’écran', () => {
    const projected = projectEarthSkyBodies(
      [{ ...body('moon', TARGET), skyObjectKind: 'moon' }],
      TARGET,
      null,
      { width: 800, height: 600 },
    );
    const moonAtLeftEdge = { ...projected[0]!, name: 'Lune', xPercent: 2 };
    const laidOut = layoutEarthSkyBodyLabels([moonAtLeftEdge], { width: 800, height: 600 });

    expect(laidOut[0]).toMatchObject({
      xPercent: 2,
      labelPlacement: 'right',
      labelVisible: true,
    });
    expect(laidOut[0]!.labelOffsetXPixels).toBeGreaterThan(0);
  });

  it('masque seulement les noms secondaires lorsqu’aucun emplacement libre ne subsiste', () => {
    const projected = projectEarthSkyBodies(
      Array.from({ length: 10 }, (_, index) => ({
        ...body(`satellite-${index}`, TARGET),
        skyObjectKind: 'satellite' as const,
      })),
      TARGET,
      null,
      { width: 180, height: 80 },
    ).map((projectedBody) => ({ ...projectedBody, name: 'Io' }));
    const laidOut = layoutEarthSkyBodyLabels(projected, { width: 180, height: 80 }, [
      'satellite-9',
    ]);

    expect(laidOut.find(({ id }) => id === 'satellite-9')?.labelVisible).toBe(true);
    expect(laidOut.some(({ labelVisible }) => !labelVisible)).toBe(true);
    expectLabelsNotToOverlap(laidOut.filter(({ labelVisible }) => labelVisible));

    const impossible = layoutEarthSkyBodyLabels(
      [{ ...projected[0]!, name: 'Nom beaucoup trop long pour ce minuscule écran' }],
      { width: 40, height: 30 },
    );

    expect(impossible[0]?.labelVisible).toBe(false);
  });
});

type LabelledProjectedBody = ProjectedEarthSkyBody &
  EarthSkyBodyLabelLayout & { readonly name: string };

function expectLabelsNotToOverlap(bodies: readonly LabelledProjectedBody[]): void {
  const rectangles = bodies.map((body) => {
    const centerX = (body.xPercent / 100) * 800 + body.labelOffsetXPixels;
    const centerY = (body.yPercent / 100) * 600 + body.labelOffsetYPixels;
    const width = [...body.name].length * 7 + 14;

    return {
      left: centerX - width / 2,
      top: centerY - 10,
      right: centerX + width / 2,
      bottom: centerY + 10,
    };
  });

  rectangles.forEach((first, firstIndex) => {
    rectangles.slice(firstIndex + 1).forEach((second) => {
      expect(
        first.left < second.right + 4 &&
          first.right + 4 > second.left &&
          first.top < second.bottom + 4 &&
          first.bottom + 4 > second.top,
      ).toBe(false);
    });
  });
}

function body(
  id: SolarSystemSkyObservation['id'],
  skyObservation: StellarObservation,
  angularDiameterDegrees = 0.01,
): SolarSystemSkyObservation {
  return {
    id,
    fallbackName: id,
    color: '#fff',
    angularSizeClass: 'planet',
    skyObjectKind: 'planet',
    assistedVisibility: false,
    angularDiameterDegrees,
    angularDiameterConfidence: 'calculated',
    appearanceConfidence: 'observed-adapted',
    positionConfidence: 'calculated',
    direction: { x: 0, y: 0, z: -1 },
    lunarIllumination: null,
    observation: skyObservation,
    textureUrl: '/textures/jupiter-hubble-1024.jpg',
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
