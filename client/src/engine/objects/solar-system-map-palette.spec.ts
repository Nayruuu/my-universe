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
    expect(getSolarSystemMapAccent('unknown', true)).toBe('#ffe1a2');
  });

  it.each([
    ['moon', 'earth'],
    ['phobos', 'mars'],
    ['europa', 'jupiter'],
    ['enceladus', 'saturn'],
    ['titania', 'uranus'],
    ['triton', 'neptune'],
    ['charon', 'pluto'],
  ])('rattache visuellement %s à la couleur cartographique de %s', (satellite, parent) => {
    expect(getSolarSystemMapAccent(satellite, false)).toBe(getSolarSystemMapAccent(parent, false));
    expect(getSolarSystemMapAccent(satellite, true)).toBe(getSolarSystemMapAccent(parent, true));
  });

  it('différencie les familles de petits corps héliocentriques', () => {
    expect(getSolarSystemMapAccent('eris', false)).toBe('#9d72ca');
    expect(getSolarSystemMapAccent('bennu', false)).toBe('#b88a57');
    expect(getSolarSystemMapAccent('67p-churyumov-gerasimenko', false)).toBe('#55a99f');
  });
});
