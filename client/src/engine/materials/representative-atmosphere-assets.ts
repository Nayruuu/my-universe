export interface RepresentativeAtmosphereDefinition {
  readonly assetPath: string;
  readonly sourceUrl: string;
  readonly sourceName: 'NASA Visualization Technology Applications and Development';
  readonly visualStyle: 'illustrative-nasa-vtad-atmosphere-map';
  readonly scientificConfidence: 'illustrative';
  readonly colorTreatment: 'processed-color';
  readonly projectionTreatment: 'cubemap-to-equirectangular' | 'source-equirectangular';
}

const NASA_VTAD_SOURCE_NAME = 'NASA Visualization Technology Applications and Development';

const REPRESENTATIVE_ATMOSPHERES: Readonly<Record<string, RepresentativeAtmosphereDefinition>> = {
  saturn: nasaAtmosphere(
    'textures/saturn-nasa-vtad-2048.jpg',
    'https://science.nasa.gov/resource/saturn-3d-model/',
    'cubemap-to-equirectangular',
  ),
  uranus: nasaAtmosphere(
    'textures/uranus-nasa-vtad-1024.jpg',
    'https://science.nasa.gov/resource/uranus-3d-model/',
    'source-equirectangular',
  ),
  neptune: nasaAtmosphere(
    'textures/neptune-nasa-vtad-1024.jpg',
    'https://science.nasa.gov/resource/neptune-3d-model/',
    'source-equirectangular',
  ),
};

export function getRepresentativeAtmosphereDefinition(
  objectId: string,
): RepresentativeAtmosphereDefinition | null {
  return REPRESENTATIVE_ATMOSPHERES[objectId] ?? null;
}

function nasaAtmosphere(
  assetPath: string,
  sourceUrl: string,
  projectionTreatment: RepresentativeAtmosphereDefinition['projectionTreatment'],
): RepresentativeAtmosphereDefinition {
  return {
    assetPath,
    sourceUrl,
    sourceName: NASA_VTAD_SOURCE_NAME,
    visualStyle: 'illustrative-nasa-vtad-atmosphere-map',
    scientificConfidence: 'illustrative',
    colorTreatment: 'processed-color',
    projectionTreatment,
  };
}
