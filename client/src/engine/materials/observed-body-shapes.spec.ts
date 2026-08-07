import { getObservedBodyShapeDefinition } from './observed-body-shapes';

describe('observed body shapes', () => {
  it.each([
    {
      id: 'phobos',
      assetPath: 'models/phobos-nasa-jpl.glb',
      sourceUrl: 'https://science.nasa.gov/resource/phobos-mars-moon-3d-model/',
      fallbackColor: '#8f7968',
    },
    {
      id: 'deimos',
      assetPath: 'models/deimos-nasa-jpl.glb',
      sourceUrl: 'https://science.nasa.gov/resource/deimos-mars-moon-3d-model/',
      fallbackColor: '#a18b78',
    },
  ])('décrit la forme et la surface observées NASA/JPL de $id', (expected) => {
    expect(getObservedBodyShapeDefinition(expected.id)).toEqual({
      assetPath: expected.assetPath,
      format: 'gltf',
      sourceName: 'NASA/JPL-Caltech',
      sourceUrl: expected.sourceUrl,
      scientificConfidence: 'observed',
      surfaceConfidence: 'observed',
      fallbackColor: expected.fallbackColor,
    });
  });

  it.each([
    {
      id: 'ceres',
      assetPath: 'models/ceres-nasa-vtad.glb',
      sourceUrl: 'https://science.nasa.gov/resource/ceres-3d-model/',
      fallbackColor: '#8e8b84',
    },
    {
      id: 'vesta',
      assetPath: 'models/vesta-nasa-vtad.glb',
      sourceUrl: 'https://science.nasa.gov/resource/vesta-3d-model/',
      fallbackColor: '#a9a39a',
    },
  ])('décrit la forme et la surface observées NASA VTAD de $id', (expected) => {
    expect(getObservedBodyShapeDefinition(expected.id)).toEqual({
      assetPath: expected.assetPath,
      format: 'gltf',
      sourceName: 'NASA Visualization Technology Applications and Development',
      sourceUrl: expected.sourceUrl,
      scientificConfidence: 'observed',
      surfaceConfidence: 'observed',
      fallbackColor: expected.fallbackColor,
      illustrativeShadowFill: 0.16,
    });
  });

  it('décrit le modèle texturé NASA de Bénou', () => {
    expect(getObservedBodyShapeDefinition('bennu')).toEqual({
      assetPath: 'models/bennu-nasa-vtad.glb',
      format: 'gltf',
      sourceName: 'NASA Visualization Technology Applications and Development',
      sourceUrl: 'https://science.nasa.gov/resource/bennu-3d-model/',
      scientificConfidence: 'observed',
      surfaceConfidence: 'observed',
      fallbackColor: '#5a5651',
    });
  });

  it('décrit la forme OSIRIS de 67P sans inventer une texture photographique', () => {
    expect(getObservedBodyShapeDefinition('67p-churyumov-gerasimenko')).toEqual({
      assetPath: 'models/67p-osiris-esa.obj',
      format: 'obj',
      sourceName: 'ESA/Rosetta/MPS for OSIRIS Team MPS/UPD/LAM/IAA/SSO/INTA/UPM/DASP/IDA',
      sourceUrl: 'https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289',
      scientificConfidence: 'observed',
      surfaceConfidence: 'illustrative',
      fallbackColor: '#85817b',
    });
  });

  it.each([
    {
      id: 'pallas',
      assetPath: 'models/pallas-damit-4395.obj',
      sourceName: 'DAMIT · Marsset et al. (2020)',
      sourceUrl: 'https://damit.cuni.cz/projects/damit/asteroid_models/view/4395',
      fallbackColor: '#8e8b86',
      illustrativeShadowFill: 0.12,
    },
    {
      id: 'hygiea',
      assetPath: 'models/hygiea-damit-4392.obj',
      sourceName: 'DAMIT · Vernazza et al. (2020)',
      sourceUrl: 'https://damit.cuni.cz/projects/damit/asteroid_models/view/4392',
      fallbackColor: '#686764',
      illustrativeShadowFill: 0.1,
    },
  ])('décrit la forme reconstruite SPHERE/DAMIT de $id', (expected) => {
    expect(getObservedBodyShapeDefinition(expected.id)).toEqual({
      assetPath: expected.assetPath,
      format: 'obj',
      sourceName: expected.sourceName,
      sourceUrl: expected.sourceUrl,
      scientificConfidence: 'calculated',
      surfaceConfidence: 'illustrative',
      sourceCoordinateSystem: 'damit-z-up',
      fallbackColor: expected.fallbackColor,
      illustrativeShadowFill: expected.illustrativeShadowFill,
    });
  });

  it('retourne null pour un corps sans modèle embarqué', () => {
    expect(getObservedBodyShapeDefinition('eris')).toBeNull();
  });
});
