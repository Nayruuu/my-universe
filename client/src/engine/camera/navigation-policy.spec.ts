import { SpaceObject } from '../../data/models/universe.models';
import {
  CAMERA_FAR_DISTANCE,
  FREE_NAVIGATION_MIN_DISTANCE,
  getFocusDistance,
  getMinimumNavigationDistance,
  getOrbitOverviewDistance,
  MAX_NAVIGATION_DISTANCE,
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
