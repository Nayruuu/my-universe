import { getObservedSurfaceDefinition } from './observed-surface-assets';

describe('observed surface assets', () => {
  it.each([
    ['mercury', 'textures/mercury-messenger-usgs-1024.jpg', 'MESSENGER MDIS'],
    ['io', 'textures/io-jpl-voyager-galileo-1440.jpg', 'Voyager / Galileo'],
    ['europa', 'textures/europa-jpl-voyager-1440.jpg', 'Voyager'],
    ['ganymede', 'textures/ganymede-jpl-voyager-1440.jpg', 'Voyager'],
    ['callisto', 'textures/callisto-jpl-voyager-1440.jpg', 'Voyager'],
    ['phobos', 'textures/phobos-jpl-viking-1440.jpg', 'Viking'],
    ['deimos', 'textures/deimos-jpl-viking-1440.jpg', 'Viking'],
    ['mimas', 'textures/mimas-jpl-voyager-1440.jpg', 'Voyager'],
    ['enceladus', 'textures/enceladus-jpl-voyager-1440.jpg', 'Voyager'],
    ['tethys', 'textures/tethys-jpl-voyager-1440.jpg', 'Voyager'],
    ['dione', 'textures/dione-jpl-voyager-1440.jpg', 'Voyager'],
    ['rhea', 'textures/rhea-jpl-voyager-1440.jpg', 'Voyager'],
    ['iapetus', 'textures/iapetus-jpl-voyager-1440.jpg', 'Voyager'],
    ['ariel', 'textures/ariel-jpl-voyager-1440.jpg', 'Voyager'],
    ['umbriel', 'textures/umbriel-jpl-voyager-1440.jpg', 'Voyager'],
    ['titania', 'textures/titania-jpl-voyager-1440.jpg', 'Voyager'],
    ['oberon', 'textures/oberon-jpl-voyager-1440.jpg', 'Voyager'],
    ['miranda', 'textures/miranda-jpl-voyager-1440.jpg', 'Voyager'],
    ['triton', 'textures/triton-jpl-voyager-1440.jpg', 'Voyager'],
    ['titan', 'textures/titan-cassini-1024.jpg', 'Cassini ISS'],
    ['ceres', 'textures/ceres-dawn-1024.jpg', 'Dawn'],
    ['vesta', 'textures/vesta-dawn-1024.jpg', 'Dawn'],
    ['pluto', 'textures/pluto-new-horizons-1024.jpg', 'New Horizons'],
    ['charon', 'textures/charon-new-horizons-1024.jpg', 'New Horizons'],
  ] as const)('référence la mosaïque officielle de %s', (id, assetPath, mission) => {
    const definition = getObservedSurfaceDefinition(id);

    expect(definition).toMatchObject({
      assetPath,
      mission,
      scientificConfidence: 'observed',
    });
    expect(definition?.sourceUrl).toMatch(/^https:\/\//u);
  });

  it('ne prétend pas disposer d’une surface observée quand aucune mosaïque globale ne convient', () => {
    expect(getObservedSurfaceDefinition('eris')).toBeNull();
  });
});
