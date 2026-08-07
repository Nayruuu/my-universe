import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { MILKY_WAY_NAVIGATION_DISTANCE } from '../camera/navigation-scales';
import {
  calculateGalacticFrameScale,
  calculateMilkyWayReferenceFrameScale,
  calculateMilkyWaySceneScale,
  getGalaxyPhysicalSceneDiameter,
  getGalaxyRenderDiameter,
  getGalaxyRenderScale,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
  MILKY_WAY_PROCEDURAL_AUTHORING_THICKNESS,
  MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS,
} from './galaxy-scale-model';

describe('galaxy scale model', () => {
  it('convertit les diamètres documentés dans le référentiel linéaire du Groupe local', () => {
    const milkyWay = galaxy('milky-way', 100_000, 360);
    const andromeda = galaxy('andromeda', 260_000, 520);
    const triangulum = galaxy('triangulum', 60_000, 220);

    expect(getGalaxyPhysicalSceneDiameter(milkyWay)).toBeCloseTo(306.601, 3);
    expect(getGalaxyPhysicalSceneDiameter(andromeda)).toBeCloseTo(797.164, 3);
    expect(getGalaxyPhysicalSceneDiameter(triangulum)).toBeCloseTo(183.961, 3);
    expect(getGalaxyRenderDiameter(andromeda) / getGalaxyRenderDiameter(milkyWay)).toBeCloseTo(
      2.6,
      8,
    );
    expect(getGalaxyRenderScale(andromeda).diameterTreatment).toBe('documented-physical-diameter');
  });

  it('utilise le diamètre de demi-lumière observé pour une galaxie naine', () => {
    const dwarf = galaxy('draco-dwarf', undefined, 64);

    dwarf.metadata = { halfLightRadiusPc: 221 };
    const scale = getGalaxyRenderScale(dwarf);

    expect(scale.physicalSceneDiameter).toBeCloseTo(4.42, 6);
    expect(scale.renderDiameter).toBeCloseTo(4.42, 6);
    expect(scale.diameterTreatment).toBe('documented-half-light-diameter');
  });

  it('conserve le rayon visuel comme repli pour une galaxie sans diamètre documenté', () => {
    const dwarf = galaxy('dwarf', undefined, 72);

    expect(getGalaxyPhysicalSceneDiameter(dwarf)).toBeNull();
    expect(getGalaxyRenderDiameter(dwarf)).toBe(144);
    expect(getGalaxyRenderScale(dwarf).diameterTreatment).toBe(
      'illustrative-visual-radius-fallback',
    );
  });

  it('ignore les métadonnées de taille invalides', () => {
    const dwarf = galaxy('invalid-dwarf', undefined, 72);

    dwarf.metadata = { diameterLy: Number.NaN, halfLightRadiusPc: 0 };
    expect(getGalaxyRenderDiameter(dwarf)).toBe(144);

    dwarf.metadata = { diameterLy: 'inconnu', halfLightRadiusPc: Number.POSITIVE_INFINITY };
    expect(getGalaxyRenderDiameter(dwarf)).toBe(144);
  });

  it('ne convertit pas le diamètre d’un objet qui n’est pas une galaxie', () => {
    const star: SpaceObject = {
      ...galaxy('sun', 100_000, 1),
      type: 'star',
    };

    expect(getGalaxyPhysicalSceneDiameter(star)).toBeNull();
  });

  it('convertit continûment l’enveloppe visuelle entre les référentiels galactique et extragalactique', () => {
    const galactic = calculateMilkyWaySceneScale(3_600);
    const localGroup = calculateMilkyWaySceneScale(17_000);
    const nearbyUniverse = calculateMilkyWaySceneScale(120_000);
    const cosmicWeb = calculateMilkyWaySceneScale(420_000);
    const middle = calculateMilkyWaySceneScale(36_000);

    expect(galactic.worldDiameter).toBeCloseTo(2_759.413, 3);
    expect(galactic.physicalWorldDiameter).toBeCloseTo(2_759.413, 3);
    expect(galactic.visualScaleFactor).toBe(1);
    expect(localGroup.worldDiameter).toBeLessThan(galactic.worldDiameter);
    expect(localGroup.worldDiameter).toBeGreaterThan(nearbyUniverse.worldDiameter);
    expect(nearbyUniverse.worldDiameter).toBeCloseTo(122.64, 2);
    expect(cosmicWeb.worldDiameter).toBeCloseTo(6.132, 3);
    expect(cosmicWeb.visualScaleFactor).toBe(1);
    expect(galactic.modelScale).toBeCloseTo(
      galactic.worldDiameter / MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
      8,
    );
    expect(galactic.referenceFrameBlend).toBe('galactic');
    expect(localGroup.referenceFrameBlend).toBe('intergalactic-to-galactic');
    expect(nearbyUniverse.referenceFrameBlend).toBe('nearby-universe');
    expect(cosmicWeb.referenceFrameBlend).toBe('cosmic-web');
    expect(middle.worldDiameter).toBeLessThan(galactic.worldDiameter);
    expect(middle.worldDiameter).toBeGreaterThan(nearbyUniverse.worldDiameter);
  });

  it('respecte le diamètre du disque tout en conservant une épaisseur illustrative lisible', () => {
    const galactic = calculateMilkyWaySceneScale(MILKY_WAY_NAVIGATION_DISTANCE);
    const angularDiameterDegrees = THREE.MathUtils.radToDeg(
      2 * Math.atan(galactic.worldDiameter / 2 / MILKY_WAY_NAVIGATION_DISTANCE),
    );

    expect(galactic.worldDiameter).toBeCloseTo(2_759.413, 3);
    expect(galactic.physicalWorldDiameter).toBeCloseTo(2_759.413, 3);
    expect(galactic.worldDiameter / 2).toBeLessThan(MILKY_WAY_NAVIGATION_DISTANCE);
    expect(angularDiameterDegrees).toBeGreaterThan(41);
    expect(angularDiameterDegrees).toBeLessThan(43);
    expect(MILKY_WAY_PROCEDURAL_AUTHORING_THICKNESS).toBe(4_200);
    expect(MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS).toBe(1_100);
    expect(MILKY_WAY_PROCEDURAL_AUTHORING_THICKNESS).toBeGreaterThan(
      MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS,
    );
  });

  it('stabilise ensemble les positions galactiques et le volume avant la traversée', () => {
    const settled = calculateMilkyWaySceneScale(9_000);

    for (const distance of [9_000, 6_000, 3_600, 2_200, 900, 300]) {
      const scale = calculateMilkyWaySceneScale(distance);

      expect(scale.modelScale).toBeCloseTo(settled.modelScale, 12);
      expect(scale.worldDiameter).toBeCloseTo(settled.worldDiameter, 8);
      expect(scale.physicalWorldDiameter).toBeCloseTo(
        calculateMilkyWayReferenceFrameScale(distance).worldDiameter,
        8,
      );
    }
  });

  it('place le Soleil à 53 % du rayon du disque, sans dérive relative pendant le zoom', () => {
    // Independent references: GRAVITY 2019 R0 = 8.178 kpc, the documented 100,000 ly disc,
    // and 1 kpc = 3,261.563777 ly. https://doi.org/10.1051/0004-6361/201935656
    const expectedSolarRadiusFraction = (8.178 * 3_261.563777) / 50_000;

    for (const distance of [420_000, 120_000, 60_000, 24_000, 18_000, 13_300, 9_000, 3_600, 220]) {
      const scene = calculateMilkyWaySceneScale(distance);
      const solarDistance = 736.02 * calculateGalacticFrameScale(distance);

      expect(scene.worldDiameter).toBe(scene.physicalWorldDiameter);
      expect(scene.visualSceneUnitsPerKiloparsec).toBe(scene.referenceFrameSceneUnitsPerKiloparsec);
      expect(scene.visualScaleFactor).toBe(1);
      expect(solarDistance / (scene.worldDiameter / 2)).toBeCloseTo(expectedSolarRadiusFraction, 6);
    }
  });

  it('ne crée aucun saut aux limites de changement de référentiel', () => {
    for (const boundary of [3_600, 17_000, 18_000, 120_000, 420_000]) {
      const before = calculateMilkyWaySceneScale(boundary - 0.01).worldDiameter;
      const after = calculateMilkyWaySceneScale(boundary + 0.01).worldDiameter;
      const physicalBefore = calculateMilkyWayReferenceFrameScale(boundary - 0.01).worldDiameter;
      const physicalAfter = calculateMilkyWayReferenceFrameScale(boundary + 0.01).worldDiameter;

      expect(Math.abs(after - before)).toBeLessThan(0.01);
      expect(Math.abs(physicalAfter - physicalBefore)).toBeLessThan(0.01);
    }
  });

  it('conserve la conversion canonique du Soleil sans changer ses coordonnées', () => {
    expect(calculateGalacticFrameScale(3_600)).toBe(1);
    expect(calculateGalacticFrameScale(17_000)).toBeGreaterThan(0.7);
    expect(calculateGalacticFrameScale(17_000)).toBeLessThan(0.8);
    expect(calculateGalacticFrameScale(120_000)).toBeCloseTo(4 / 90, 8);
    expect(calculateGalacticFrameScale(420_000)).toBeCloseTo(0.2 / 90, 8);
  });
});

function galaxy(id: string, diameterLy: number | undefined, visualRadius: number): SpaceObject {
  return {
    id,
    name: id,
    type: 'galaxy',
    referenceFrame: 'local-group',
    scientificConfidence: 'observed',
    visual: { visualRadius, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'kiloparsec',
    },
    metadata: diameterLy === undefined ? undefined : { diameterLy },
  };
}
