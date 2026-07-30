import { CoordinateSystem } from './coordinate-system';
import { convertDistance, unitInKilometers } from './unit-conversion';

describe('conversion des distances', () => {
  it('convertit une unité astronomique en kilomètres', () => {
    expect(convertDistance(1, 'astronomical-unit', 'kilometer')).toBeCloseTo(149_597_870.7, 3);
  });

  it('convertit un parsec en années-lumière', () => {
    expect(convertDistance(1, 'parsec', 'light-year')).toBeCloseTo(3.26156, 4);
    expect(unitInKilometers('kilometer')).toBe(1);
  });

  it('utilise une échelle propre au référentiel solaire', () => {
    const coordinates = new CoordinateSystem();

    expect(coordinates.toSceneDistance(1, 'astronomical-unit', 'solar-system')).toBe(15);
    expect(coordinates.toSceneDistance(149_597_870.7, 'kilometer', 'solar-system')).toBeCloseTo(
      15,
      8,
    );
  });

  it('compresse les distances stellaires sans changer leur direction', () => {
    const coordinates = new CoordinateSystem();
    const rendered = coordinates.toRenderPosition([3, 4, 0], 'light-year', 'stellar');

    expect(rendered.x / rendered.y).toBeCloseTo(3 / 4, 8);
    expect(Math.hypot(rendered.x, rendered.y, rendered.z)).toBeLessThan(1_000);
  });

  it('préserve linéairement les positions du Groupe local en kiloparsecs', () => {
    const coordinates = new CoordinateSystem();
    const rendered = coordinates.toRenderPosition([100, -20, 30], 'kiloparsec', 'local-group');

    expect(rendered).toEqual({ x: 1_000, y: -200, z: 300 });
  });

  it('couvre explicitement les quatre référentiels et le vecteur nul', () => {
    const coordinates = new CoordinateSystem();

    expect(coordinates.toSceneDistance(1, 'light-year', 'stellar')).toBe(250);
    expect(coordinates.toSceneDistance(1, 'kiloparsec', 'galactic')).toBe(90);
    expect(coordinates.toRenderPosition([0, 0, 0], 'parsec', 'galactic')).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    const galactic = coordinates.toRenderPosition([3, 0, 4], 'kiloparsec', 'galactic');

    expect(galactic.x / galactic.z).toBeCloseTo(3 / 4, 8);
    expect(coordinates.getLinearMotionScale('astronomical-unit', 'solar-system')).toBe(15);
    expect(coordinates.getLinearMotionScale('light-year', 'stellar')).toBe(250);
    expect(coordinates.getLinearMotionScale('kiloparsec', 'galactic')).toBe(90);
    expect(coordinates.getLinearMotionScale('kiloparsec', 'local-group')).toBe(10);
    expect(coordinates.sceneUnitsToAstronomicalUnits(30)).toBe(2);
  });
});
