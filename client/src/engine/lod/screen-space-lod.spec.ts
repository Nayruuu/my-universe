import {
  calculateApparentRadiusPixels,
  calculateNearRepresentationBlend,
  calculateWorldDiameterForPixels,
  dampValue,
  getMinimumVisualDiameterPixels,
  shouldDisplayObjectAtLevel,
} from './screen-space-lod';
import { SpaceObject } from '../../data/models/universe.models';

const planet = {
  id: 'earth',
  type: 'planet',
} as SpaceObject;
const exoplanet = {
  ...planet,
  id: 'kepler-452-b',
  type: 'exoplanet',
  referenceFrame: 'stellar',
} as SpaceObject;
const blackHole = {
  ...planet,
  id: 'sagittarius-a-star',
  type: 'black-hole',
  referenceFrame: 'galactic',
} as SpaceObject;
const stellarBlackHole = {
  ...blackHole,
  id: 'gaia-bh1',
  referenceFrame: 'stellar',
} as SpaceObject;
const supernova = {
  ...planet,
  id: 'sn-1987a',
  type: 'supernova',
  referenceFrame: 'stellar',
} as SpaceObject;

const nearbyStar = {
  id: 'sirius',
  type: 'star',
} as SpaceObject;

const galaxy = {
  id: 'milky-way',
  type: 'galaxy',
} as SpaceObject;

const neighboringGalaxy = {
  id: 'andromeda',
  type: 'galaxy',
} as SpaceObject;

describe('LOD en espace écran', () => {
  it('calcule une taille apparente décroissante avec la distance', () => {
    const near = calculateApparentRadiusPixels(1, 10, 900, 48);
    const far = calculateApparentRadiusPixels(1, 100, 900, 48);

    expect(near).toBeCloseTo(far * 10, 8);
  });

  it('effectue un fondu borné entre imposteur et modèle détaillé', () => {
    expect(calculateNearRepresentationBlend(1)).toBe(0);
    expect(calculateNearRepresentationBlend(7)).toBeGreaterThan(0);
    expect(calculateNearRepresentationBlend(20)).toBe(1);
  });

  it('conserve une taille minimale stable pour un imposteur distant', () => {
    const diameter = calculateWorldDiameterForPixels(5, 100, 1_000, 50);
    const projectedRadius = calculateApparentRadiusPixels(diameter / 2, 100, 1_000, 50);

    expect(projectedRadius * 2).toBeCloseTo(5, 8);
  });

  it('rend les galaxies réellement lisibles aux échelles extragalactiques', () => {
    expect(getMinimumVisualDiameterPixels(planet, 0, 5)).toBe(5);
    expect(getMinimumVisualDiameterPixels(planet, 5, 5)).toBe(8);
    expect(getMinimumVisualDiameterPixels(neighboringGalaxy, 4, 5)).toBe(20);
    expect(getMinimumVisualDiameterPixels(neighboringGalaxy, 5, 5)).toBe(11);
    expect(getMinimumVisualDiameterPixels(neighboringGalaxy, 6, 5)).toBe(8);
  });

  it('filtre les familles astronomiques selon l’échelle tout en gardant la sélection', () => {
    expect(shouldDisplayObjectAtLevel(planet, 0, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(planet, 2, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(planet, 2, true)).toBe(true);
    expect(shouldDisplayObjectAtLevel(exoplanet, 0, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(exoplanet, 1, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(exoplanet, 2, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(nearbyStar, 0, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(nearbyStar, 1, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(nearbyStar, 2, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(nearbyStar, 3, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(galaxy, 3, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(galaxy, 2, true)).toBe(true);
    expect(shouldDisplayObjectAtLevel(galaxy, 3, true)).toBe(true);
    expect(shouldDisplayObjectAtLevel(neighboringGalaxy, 3, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(neighboringGalaxy, 4, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(neighboringGalaxy, 6, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(galaxy, 6, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(galaxy, 6, true)).toBe(true);
    expect(shouldDisplayObjectAtLevel(neighboringGalaxy, 3, true)).toBe(true);
    expect(shouldDisplayObjectAtLevel(blackHole, 0, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(blackHole, 1, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(blackHole, 3, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(blackHole, 4, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(blackHole, 4, true)).toBe(true);
    expect(shouldDisplayObjectAtLevel(stellarBlackHole, 1, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(stellarBlackHole, 2, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(stellarBlackHole, 3, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(supernova, 0, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(supernova, 1, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(supernova, 2, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(supernova, 3, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(supernova, 4, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel({ ...supernova, type: 'supernova-remnant' }, 2, false)).toBe(
      true,
    );
    expect(dampValue(0, 1, 8, 0.2)).toBeGreaterThan(0);
  });

  it('retourne zéro pour chaque géométrie de projection invalide', () => {
    expect(calculateApparentRadiusPixels(0, 1, 1, 1)).toBe(0);
    expect(calculateApparentRadiusPixels(1, 0, 1, 1)).toBe(0);
    expect(calculateApparentRadiusPixels(1, 1, 0, 1)).toBe(0);
    expect(calculateApparentRadiusPixels(1, 1, 1, 0)).toBe(0);
    expect(calculateWorldDiameterForPixels(0, 1, 1, 48)).toBe(0);
    expect(calculateWorldDiameterForPixels(1, 0, 1, 48)).toBe(0);
    expect(calculateWorldDiameterForPixels(1, 1, 0, 48)).toBe(0);
    expect(dampValue(2, 5, 8, 0)).toBe(2);
  });

  it('traite toutes les familles astronomiques aux frontières de LOD', () => {
    expect(shouldDisplayObjectAtLevel({ ...planet, type: 'dwarf-planet' }, 1, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel({ ...planet, type: 'moon' }, 2, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel({ ...planet, type: 'asteroid' }, 1, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel({ ...planet, type: 'comet' }, 2, false)).toBe(false);
    const sun = { ...nearbyStar, id: 'sun' };

    expect(shouldDisplayObjectAtLevel(sun, 0, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(sun, 2, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(sun, 3, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel(galaxy, 2, false)).toBe(false);
    expect(shouldDisplayObjectAtLevel(galaxy, 5, false)).toBe(true);
    expect(shouldDisplayObjectAtLevel({ ...planet, type: 'region' }, 4, false)).toBe(true);
  });
});
