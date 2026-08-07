import blackHoleSource from '../../../public/data/black-holes/catalog.json';
import featuredExoplanetSource from '../../../public/data/exoplanets/featured-systems.json';
import localGroupSource from '../../../public/data/galaxies/local-group.json';
import extendedSolarSystemSource from '../../../public/data/solar-system/extended.json';
import solarSystemSource from '../../../public/data/solar-system/system.json';
import nearbyStarSource from '../../../public/data/stars/nearby-stars.json';
import supernovaSource from '../../../public/data/supernovas/catalog.json';
import type { SpaceObject } from '../../data/models/universe.models';
import { parseUniverseDataset } from '../../data/validation/dataset-validator';
import { createObjectRegistryAssemblyPlan } from '../objects/object-registry-assembly';
import { CoordinateSystem } from './coordinate-system';
import { convertDistance } from './unit-conversion';

const sources = [
  solarSystemSource,
  extendedSolarSystemSource,
  nearbyStarSource,
  featuredExoplanetSource,
  blackHoleSource,
  supernovaSource,
  localGroupSource,
] as const;

describe('contrat de projection entre référentiels', () => {
  const objects = sources.flatMap(
    (source, index) => parseUniverseDataset(source, `reference-frame-${index}`).objects,
  );

  it('réserve le référentiel galactocentrique au Soleil et au centre galactique', () => {
    expect(
      objects
        .filter(({ referenceFrame }) => referenceFrame === 'galactic')
        .map(({ id }) => id)
        .sort(),
    ).toEqual(['sagittarius-a-star', 'sun']);
  });

  it('ancre au Soleil chaque position héliocentrique rendue individuellement', () => {
    const plan = createObjectRegistryAssemblyPlan(objects);
    const heliocentricObjects = plan.renderableObjects.filter(
      ({ parentId, referenceFrame }) => parentId === 'milky-way' && referenceFrame === 'stellar',
    );

    expect(heliocentricObjects.length).toBeGreaterThan(5);
    for (const object of heliocentricObjects) {
      expect(plan.renderParentById.get(object.id)).toBe('sun');
    }
    expect(plan.renderParentById.get('sagittarius-a-star')).toBe('milky-way');
  });

  it('conserve la norme scientifique de chaque position héliocentrique statique', () => {
    const candidates = objects.filter(isDocumentedHeliocentricStaticObject);

    expect(candidates.length).toBeGreaterThan(10);
    for (const object of candidates) {
      const provider = object.positionProvider;
      const documentedDistanceLy = object.metadata?.['distanceLy'];

      if (provider.type !== 'static' || typeof documentedDistanceLy !== 'number') {
        throw new Error(`Contrat héliocentrique incomplet pour ${object.id}.`);
      }
      const measuredDistanceLy = convertDistance(
        Math.hypot(...provider.position),
        provider.unit,
        'light-year',
      );

      expect(measuredDistanceLy).toBeCloseTo(documentedDistanceLy, 0);
    }
  });

  it('préserve l’ordre radial après compression à l’échelle stellaire', () => {
    const coordinates = new CoordinateSystem();
    const candidates = objects
      .filter(isDocumentedHeliocentricStaticObject)
      .map((object) => {
        const provider = object.positionProvider;

        if (provider.type !== 'static') {
          throw new Error(`Position statique manquante pour ${object.id}.`);
        }
        const rendered = coordinates.toRenderPosition(provider.position, provider.unit, 'stellar');

        return {
          id: object.id,
          scientificDistanceLy: object.metadata?.['distanceLy'] as number,
          renderedDistance: Math.hypot(rendered.x, rendered.y, rendered.z),
        };
      })
      .sort((left, right) => left.scientificDistanceLy - right.scientificDistanceLy);

    for (let index = 1; index < candidates.length; index += 1) {
      expect(candidates[index]!.renderedDistance).toBeGreaterThanOrEqual(
        candidates[index - 1]!.renderedDistance,
      );
    }
  });
});

function isDocumentedHeliocentricStaticObject(object: SpaceObject): boolean {
  return (
    object.referenceFrame === 'stellar' &&
    object.parentId === 'milky-way' &&
    object.positionProvider.type === 'static' &&
    typeof object.metadata?.['distanceLy'] === 'number'
  );
}
