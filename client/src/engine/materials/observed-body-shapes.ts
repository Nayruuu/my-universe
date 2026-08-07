export type ObservedBodyShapeFormat = 'gltf' | 'obj';
export type ObservedBodyShapeCoordinateSystem = 'damit-z-up';

export interface ObservedBodyShapeDefinition {
  readonly assetPath: string;
  readonly format: ObservedBodyShapeFormat;
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly scientificConfidence: 'observed' | 'calculated';
  readonly surfaceConfidence: 'observed' | 'illustrative';
  readonly sourceCoordinateSystem?: ObservedBodyShapeCoordinateSystem;
  readonly fallbackColor: string;
  readonly illustrativeShadowFill?: number;
}

const OBSERVED_BODY_SHAPES: Readonly<Record<string, ObservedBodyShapeDefinition>> = {
  phobos: nasaMartianMoon(
    'models/phobos-nasa-jpl.glb',
    'https://science.nasa.gov/resource/phobos-mars-moon-3d-model/',
    '#8f7968',
  ),
  deimos: nasaMartianMoon(
    'models/deimos-nasa-jpl.glb',
    'https://science.nasa.gov/resource/deimos-mars-moon-3d-model/',
    '#a18b78',
  ),
  ceres: nasaVtadBody(
    'models/ceres-nasa-vtad.glb',
    'https://science.nasa.gov/resource/ceres-3d-model/',
    '#8e8b84',
    0.16,
  ),
  vesta: nasaVtadBody(
    'models/vesta-nasa-vtad.glb',
    'https://science.nasa.gov/resource/vesta-3d-model/',
    '#a9a39a',
    0.16,
  ),
  pallas: damitBody(
    'models/pallas-damit-4395.obj',
    'Marsset et al. (2020)',
    'https://damit.cuni.cz/projects/damit/asteroid_models/view/4395',
    '#8e8b86',
    0.12,
  ),
  hygiea: damitBody(
    'models/hygiea-damit-4392.obj',
    'Vernazza et al. (2020)',
    'https://damit.cuni.cz/projects/damit/asteroid_models/view/4392',
    '#686764',
    0.1,
  ),
  bennu: nasaVtadBody(
    'models/bennu-nasa-vtad.glb',
    'https://science.nasa.gov/resource/bennu-3d-model/',
    '#5a5651',
  ),
  '67p-churyumov-gerasimenko': {
    assetPath: 'models/67p-osiris-esa.obj',
    format: 'obj',
    sourceName: 'ESA/Rosetta/MPS for OSIRIS Team MPS/UPD/LAM/IAA/SSO/INTA/UPM/DASP/IDA',
    sourceUrl: 'https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289',
    scientificConfidence: 'observed',
    surfaceConfidence: 'illustrative',
    fallbackColor: '#85817b',
  },
};

function nasaMartianMoon(
  assetPath: string,
  sourceUrl: string,
  fallbackColor: string,
): ObservedBodyShapeDefinition {
  return {
    assetPath,
    format: 'gltf',
    sourceName: 'NASA/JPL-Caltech',
    sourceUrl,
    scientificConfidence: 'observed',
    surfaceConfidence: 'observed',
    fallbackColor,
  };
}

function damitBody(
  assetPath: string,
  publication: string,
  sourceUrl: string,
  fallbackColor: string,
  illustrativeShadowFill: number,
): ObservedBodyShapeDefinition {
  return {
    assetPath,
    format: 'obj',
    sourceName: `DAMIT · ${publication}`,
    sourceUrl,
    scientificConfidence: 'calculated',
    surfaceConfidence: 'illustrative',
    sourceCoordinateSystem: 'damit-z-up',
    fallbackColor,
    illustrativeShadowFill,
  };
}

function nasaVtadBody(
  assetPath: string,
  sourceUrl: string,
  fallbackColor: string,
  illustrativeShadowFill?: number,
): ObservedBodyShapeDefinition {
  return {
    assetPath,
    format: 'gltf',
    sourceName: 'NASA Visualization Technology Applications and Development',
    sourceUrl,
    scientificConfidence: 'observed',
    surfaceConfidence: 'observed',
    fallbackColor,
    ...(illustrativeShadowFill === undefined ? {} : { illustrativeShadowFill }),
  };
}

export function getObservedBodyShapeDefinition(
  objectId: string,
): ObservedBodyShapeDefinition | null {
  return OBSERVED_BODY_SHAPES[objectId] ?? null;
}
