import { getRepresentativeAtmosphereDefinition } from './representative-atmosphere-assets';

describe('representative atmosphere assets', () => {
  it.each([
    ['saturn', 'textures/saturn-nasa-vtad-2048.jpg', 'cubemap-to-equirectangular'],
    ['uranus', 'textures/uranus-nasa-vtad-1024.jpg', 'source-equirectangular'],
    ['neptune', 'textures/neptune-nasa-vtad-1024.jpg', 'source-equirectangular'],
  ] as const)('référence l’atmosphère NASA adaptée de %s', (id, assetPath, projectionTreatment) => {
    const definition = getRepresentativeAtmosphereDefinition(id);

    expect(definition).toMatchObject({
      assetPath,
      projectionTreatment,
      scientificConfidence: 'illustrative',
      sourceName: 'NASA Visualization Technology Applications and Development',
    });
    expect(definition?.sourceUrl).toMatch(/^https:\/\/science\.nasa\.gov\/resource\//u);
  });

  it('ne confond pas une mosaïque observée ou une surface inconnue avec un atlas atmosphérique', () => {
    expect(getRepresentativeAtmosphereDefinition('jupiter')).toBeNull();
    expect(getRepresentativeAtmosphereDefinition('titan')).toBeNull();
    expect(getRepresentativeAtmosphereDefinition('eris')).toBeNull();
  });
});
