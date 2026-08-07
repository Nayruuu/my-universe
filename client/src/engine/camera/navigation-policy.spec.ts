import { SpaceObject } from '../../data/models/universe.models';
import {
  ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER,
  ACTIVE_TARGET_POINTER_ZOOM_TAPER_DISTANCE_RATIO,
  CAMERA_FAR_DISTANCE,
  FREE_TRAVEL_ACCELERATION_LOGARITHMIC_AMOUNT,
  FREE_NAVIGATION_MIN_DISTANCE,
  getFreeTravelDistance,
  getFreeTravelDistancePerLogUnit,
  getActiveTargetPointerZoomMultiplier,
  getFocusDistance,
  getLocalNavigationCoordinatePrecision,
  getLocalNavigationDistanceTolerance,
  getMinimumNavigationDistance,
  getOrbitOverviewDistance,
  isAtMinimumNavigationDistance,
  LOCAL_NAVIGATION_DISTANCE_MARGIN_ULPS,
  MAX_NAVIGATION_DISTANCE,
  MAXIMUM_FREE_TRAVEL_SPEED_MULTIPLIER,
  MINIMUM_FREE_TRAVEL_DISTANCE_PER_LOG_UNIT,
} from './navigation-policy';

const galaxy = {
  id: 'milky-way',
  type: 'galaxy',
  visual: { visualRadius: 1_800 },
} as SpaceObject;

const earth = {
  id: 'earth',
  type: 'planet',
  visual: { visualRadius: 0.62 },
} as SpaceObject;

const localGroup = {
  id: 'local-group',
  type: 'region',
  visual: { visualRadius: 1 },
} as SpaceObject;

const nearbyUniverse = {
  id: 'nearby-universe',
  type: 'region',
  visual: { visualRadius: 1 },
} as SpaceObject;

const cosmicWeb = {
  id: 'cosmic-web',
  type: 'universe',
  visual: { visualRadius: 1 },
} as SpaceObject;

describe('politique de navigation caméra', () => {
  it('ne transforme pas le rayon illustratif d’une galaxie en barrière de zoom', () => {
    expect(getFocusDistance(galaxy)).toBeGreaterThan(2_600);
    expect(getMinimumNavigationDistance(galaxy)).toBeLessThan(2);
  });

  it('évite de traverser une planète sans bloquer son approche', () => {
    const minimum = getMinimumNavigationDistance(earth);

    expect(minimum).toBeGreaterThan(earth.visual.visualRadius);
    expect(minimum).toBeLessThan(1);
  });

  it('autorise une vue du réseau cosmique sans dépasser le plan de caméra', () => {
    expect(MAX_NAVIGATION_DISTANCE).toBeGreaterThan(420_000);
    expect(MAX_NAVIGATION_DISTANCE).toBeLessThanOrEqual(600_000);
    expect(CAMERA_FAR_DISTANCE).toBeGreaterThan(MAX_NAVIGATION_DISTANCE + 300_000);
  });

  it('cadre le Groupe local dans la plage de navigation autorisée', () => {
    expect(getFocusDistance(localGroup)).toBe(17_000);
    expect(getFocusDistance(localGroup)).toBeLessThan(MAX_NAVIGATION_DISTANCE);
  });

  it('cadre l’Univers proche dans la plage de navigation autorisée', () => {
    expect(getFocusDistance(nearbyUniverse)).toBe(120_000);
    expect(getFocusDistance(nearbyUniverse)).toBeLessThan(MAX_NAVIGATION_DISTANCE);
  });

  it('cadre le réseau cosmique et ses groupes sans quitter son niveau', () => {
    expect(getFocusDistance(cosmicWeb)).toBe(420_000);
    expect(getFocusDistance(cosmicWeb)).toBeLessThan(MAX_NAVIGATION_DISTANCE);
    expect(getFocusDistance(object('galaxy-cluster', 1))).toBe(220_000);
    expect(getFocusDistance(object('cosmic-void', 36_800))).toBe(280_000);
    expect(getFocusDistance(object('cosmic-filament', 140_000))).toBe(308_000);
  });

  it('conserve un plancher absolu lorsqu’aucun objet n’est ciblé', () => {
    expect(FREE_NAVIGATION_MIN_DISTANCE).toBeGreaterThanOrEqual(0.5);
    expect(FREE_NAVIGATION_MIN_DISTANCE).toBeLessThan(1);
  });

  it('raccorde progressivement la cadence du pointeur à celle de l’objet', () => {
    const minimumDistance = 2;

    expect(
      getActiveTargetPointerZoomMultiplier(
        minimumDistance * ACTIVE_TARGET_POINTER_ZOOM_TAPER_DISTANCE_RATIO,
        minimumDistance,
      ),
    ).toBe(ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER);
    expect(
      getActiveTargetPointerZoomMultiplier(
        minimumDistance * Math.sqrt(ACTIVE_TARGET_POINTER_ZOOM_TAPER_DISTANCE_RATIO),
        minimumDistance,
      ),
    ).toBeCloseTo(2, 12);
    expect(getActiveTargetPointerZoomMultiplier(minimumDistance, minimumDistance)).toBe(1);
    expect(getActiveTargetPointerZoomMultiplier(minimumDistance / 2, minimumDistance)).toBe(1);
  });

  it('conserve une cadence bornée lorsque le contexte du pointeur est invalide', () => {
    for (const [distance, minimumDistance] of [
      [Number.NaN, 1],
      [0, 1],
      [1, Number.NaN],
      [1, 0],
    ]) {
      expect(getActiveTargetPointerZoomMultiplier(distance, minimumDistance)).toBe(
        ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER,
      );
    }
    expect(getActiveTargetPointerZoomMultiplier(4, 1, Number.NaN)).toBe(1);
    expect(getActiveTargetPointerZoomMultiplier(4, 1, 0.5)).toBe(1);
  });

  it('mesure la précision locale de la trace HYG et tolère sa dérive de représentation', () => {
    const cameraPosition = {
      x: 1_006.929_874_991_339_8,
      y: -622.326_440_754_568_4,
      z: -842.814_659_919_010_6,
    };
    const targetPosition = {
      x: 1_006.929_874_991_342_3,
      y: -622.326_440_754_570_2,
      z: -842.814_659_919_013_4,
    };
    const precision = getLocalNavigationCoordinatePrecision(cameraPosition, targetPosition);
    const minimumDistance = 4.031_076_207_750_493e-12;
    const representedDistance = 4.124_184_931_064_759e-12;

    expect(precision).toBe(2 ** -43);
    expect(precision * LOCAL_NAVIGATION_DISTANCE_MARGIN_ULPS).toBe(3.637_978_807_091_713e-12);
    expect(isAtMinimumNavigationDistance(representedDistance, minimumDistance)).toBe(false);
    expect(
      isAtMinimumNavigationDistance(
        representedDistance,
        minimumDistance,
        getLocalNavigationDistanceTolerance(cameraPosition, targetPosition),
      ),
    ).toBe(true);
  });

  it('donne au trajet libre une vitesse interplanétaire puis l’adapte aux grands contextes', () => {
    expect(getFreeTravelDistancePerLogUnit(0.18)).toBe(MINIMUM_FREE_TRAVEL_DISTANCE_PER_LOG_UNIT);
    expect(getFreeTravelDistancePerLogUnit(10)).toBe(MINIMUM_FREE_TRAVEL_DISTANCE_PER_LOG_UNIT);
    expect(getFreeTravelDistancePerLogUnit(300)).toBe(2_400);
    expect(getFreeTravelDistancePerLogUnit(Number.NaN)).toBe(
      MINIMUM_FREE_TRAVEL_DISTANCE_PER_LOG_UNIT,
    );
  });

  it('accélère progressivement le trajet libre, le plafonne et reste indépendant du découpage', () => {
    const baseSpeed = getFreeTravelDistancePerLogUnit(0.18);
    const firstTenth = getFreeTravelDistance(0.18, 0, 0.1);
    const cruisingTenth = getFreeTravelDistance(0.18, 1, 0.1);
    const whole = getFreeTravelDistance(0.18, 0, 0.75);
    const split = getFreeTravelDistance(0.18, 0, 0.2) + getFreeTravelDistance(0.18, 0.2, 0.55);

    expect(firstTenth).toBeGreaterThan(baseSpeed * 0.1);
    expect(firstTenth).toBeLessThan(baseSpeed * 0.14);
    expect(cruisingTenth).toBeCloseTo(baseSpeed * 0.1 * MAXIMUM_FREE_TRAVEL_SPEED_MULTIPLIER, 11);
    expect(whole).toBeCloseTo(split, 12);
    expect(getFreeTravelDistance(0.18, Number.NaN, 0.1)).toBeCloseTo(firstTenth, 12);
    expect(getFreeTravelDistance(0.18, 0, 0)).toBe(0);
    expect(getFreeTravelDistance(0.18, 0, -0.1)).toBe(0);
    expect(getFreeTravelDistance(0.18, 0, Number.NaN)).toBe(0);
    expect(FREE_TRAVEL_ACCELERATION_LOGARITHMIC_AMOUNT).toBeGreaterThan(0);
  });

  it('cadre une orbite complète avec une marge indépendante du rayon de la planète', () => {
    expect(getOrbitOverviewDistance(15, 48)).toBeCloseTo(39.73, 1);
    expect(getOrbitOverviewDistance(450, 48)).toBeLessThan(1_250);
    expect(getOrbitOverviewDistance(300_000, 48)).toBe(MAX_NAVIGATION_DISTANCE);
  });

  it('couvre toutes les familles, tous les planchers et les FOV extrêmes', () => {
    expect(getOrbitOverviewDistance(0)).toBeGreaterThan(0);
    expect(getOrbitOverviewDistance(10, 1)).toBeGreaterThan(0);
    expect(getOrbitOverviewDistance(10, 180)).toBeGreaterThan(0);

    expect(getMinimumNavigationDistance(object('galaxy-cluster', 1))).toBe(1.5);
    expect(getMinimumNavigationDistance(object('star', 0.1))).toBe(0.55);
    expect(getMinimumNavigationDistance(object('star', 10))).toBe(11.5);
    expect(getMinimumNavigationDistance(object('black-hole', 0.1))).toBe(0.55);
    expect(getMinimumNavigationDistance(object('black-hole', 10))).toBe(13.5);
    expect(getMinimumNavigationDistance(object('supernova', 1))).toBe(1.2);
    expect(getMinimumNavigationDistance(object('supernova-remnant', 0.1))).toBe(0.55);
    expect(getMinimumNavigationDistance(object('dwarf-planet', 1))).toBe(1.12);
    expect(getMinimumNavigationDistance(object('exoplanet', 1))).toBe(1.12);
    expect(getMinimumNavigationDistance(object('moon', 0.01))).toBe(0.18);
    expect(getMinimumNavigationDistance(object('asteroid', 1))).toBe(1.08);

    expect(getFocusDistance(object('galaxy', 1))).toBe(2_800);
    expect(getFocusDistance(object('galaxy', 2_000))).toBe(3_100);
    expect(getFocusDistance(object('star', 1, 'sun'))).toBe(24);
    expect(getFocusDistance(object('star', 10, 'sun'))).toBe(85);
    expect(getFocusDistance(object('star', 1))).toBe(16);
    expect(getFocusDistance(object('star', 10))).toBe(100);
    expect(getFocusDistance(object('black-hole', 1))).toBe(22);
    expect(getFocusDistance(object('black-hole', 10))).toBe(120);
    expect(getFocusDistance(object('supernova', 1))).toBe(14);
    expect(getFocusDistance(object('supernova-remnant', 10))).toBe(80);
    expect(getFocusDistance(object('planet', 0.1))).toBe(4.5);
    expect(getFocusDistance(object('exoplanet', 0.1))).toBe(4.5);
    expect(getFocusDistance(object('dwarf-planet', 1))).toBe(8);
    expect(getFocusDistance(object('moon', 0.1))).toBe(3.2);
    expect(getFocusDistance(object('moon', 1))).toBe(9);
    expect(getFocusDistance(object('supercluster', 1))).toBe(280_000);
    expect(getFocusDistance(object('cosmic-wall', 1))).toBe(280_000);
    expect(getFocusDistance(object('cosmic-filament', 1))).toBe(280_000);
    expect(getFocusDistance(object('cosmic-void', 1))).toBe(280_000);
    expect(getFocusDistance(object('cosmic-basin', 1))).toBe(280_000);
    expect(getFocusDistance(object('cosmic-attractor', 1))).toBe(280_000);
    expect(getFocusDistance(object('cosmic-repeller', 400_000))).toBe(MAX_NAVIGATION_DISTANCE);
    expect(getFocusDistance(object('comet', 1))).toBe(10);
    expect(getFocusDistance(object('comet', 10))).toBe(40);
  });
});

function object(type: SpaceObject['type'], visualRadius: number, id = `test-${type}`): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
