import { getSolarSystemMapAccent } from './solar-system-map-palette';

describe('palette cartographique du Système solaire', () => {
  it.each([
    ['sun', '#ffd45c', '#fff0aa'],
    ['mercury', '#a7b0ba', '#dce4ed'],
    ['venus', '#e0a141', '#ffd17c'],
    ['earth', '#43b4dd', '#9ae8ff'],
    ['mars', '#d65e48', '#ff9e83'],
    ['jupiter', '#dd9347', '#ffc985'],
    ['saturn', '#d9bd55', '#ffe590'],
    ['uranus', '#55c9c3', '#a0fff5'],
    ['neptune', '#5975df', '#9db1ff'],
    ['pluto', '#9d72ca', '#d4a8ff'],
  ])('attribue à %s une teinte stable et une variante active', (objectId, base, active) => {
    expect(getSolarSystemMapAccent(objectId, false)).toBe(base);
    expect(getSolarSystemMapAccent(objectId, true)).toBe(active);
  });

  it('conserve un accent neutre pour les petits corps non répertoriés', () => {
    expect(getSolarSystemMapAccent('moon', false)).toBe('#c6a96f');
    expect(getSolarSystemMapAccent('unknown', true)).toBe('#ffe1a2');
  });
});
