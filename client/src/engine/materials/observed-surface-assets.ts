export interface ObservedSurfaceDefinition {
  readonly assetPath: string;
  readonly sourceUrl: string;
  readonly mission: string;
  readonly visualStyle:
    | 'observed-jpl-spacecraft-global-mosaic'
    | 'observed-messenger-global-mosaic'
    | 'observed-dawn-global-mosaic'
    | 'observed-new-horizons-global-mosaic'
    | 'observed-cassini-global-mosaic';
  readonly scientificConfidence: 'observed';
  readonly colorTreatment: 'grayscale' | 'processed-color';
}

const JPL_BASE = 'https://space.jpl.nasa.gov/tmaps';

const OBSERVED_SURFACES: Readonly<Record<string, ObservedSurfaceDefinition>> = {
  mercury: {
    assetPath: 'textures/mercury-messenger-usgs-1024.jpg',
    sourceUrl: 'https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_mosaic_250m',
    mission: 'MESSENGER MDIS',
    visualStyle: 'observed-messenger-global-mosaic',
    scientificConfidence: 'observed',
    colorTreatment: 'grayscale',
  },
  phobos: jpl('phobos-jpl-viking-1440.jpg', 'mars', 'Viking', 'grayscale'),
  deimos: jpl('deimos-jpl-viking-1440.jpg', 'mars', 'Viking', 'grayscale'),
  io: jpl('io-jpl-voyager-galileo-1440.jpg', 'jupiter', 'Voyager / Galileo', 'processed-color'),
  europa: jpl('europa-jpl-voyager-1440.jpg', 'jupiter', 'Voyager', 'grayscale'),
  ganymede: jpl('ganymede-jpl-voyager-1440.jpg', 'jupiter', 'Voyager', 'grayscale'),
  callisto: jpl('callisto-jpl-voyager-1440.jpg', 'jupiter', 'Voyager', 'grayscale'),
  mimas: jpl('mimas-jpl-voyager-1440.jpg', 'saturn', 'Voyager', 'grayscale'),
  enceladus: jpl('enceladus-jpl-voyager-1440.jpg', 'saturn', 'Voyager', 'grayscale'),
  tethys: jpl('tethys-jpl-voyager-1440.jpg', 'saturn', 'Voyager', 'grayscale'),
  dione: jpl('dione-jpl-voyager-1440.jpg', 'saturn', 'Voyager', 'grayscale'),
  rhea: jpl('rhea-jpl-voyager-1440.jpg', 'saturn', 'Voyager', 'grayscale'),
  iapetus: jpl('iapetus-jpl-voyager-1440.jpg', 'saturn', 'Voyager', 'grayscale'),
  ariel: jpl('ariel-jpl-voyager-1440.jpg', 'uranus', 'Voyager', 'grayscale'),
  umbriel: jpl('umbriel-jpl-voyager-1440.jpg', 'uranus', 'Voyager', 'grayscale'),
  titania: jpl('titania-jpl-voyager-1440.jpg', 'uranus', 'Voyager', 'grayscale'),
  oberon: jpl('oberon-jpl-voyager-1440.jpg', 'uranus', 'Voyager', 'grayscale'),
  miranda: jpl('miranda-jpl-voyager-1440.jpg', 'uranus', 'Voyager', 'grayscale'),
  triton: jpl('triton-jpl-voyager-1440.jpg', 'neptune', 'Voyager', 'processed-color'),
  titan: {
    assetPath: 'textures/titan-cassini-1024.jpg',
    sourceUrl: 'https://astrogeology.usgs.gov/search/map/titan_cassini_iss_global_mosaic_4005m',
    mission: 'Cassini ISS',
    visualStyle: 'observed-cassini-global-mosaic',
    scientificConfidence: 'observed',
    colorTreatment: 'grayscale',
  },
  ceres: {
    assetPath: 'textures/ceres-dawn-1024.jpg',
    sourceUrl: 'https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_400m',
    mission: 'Dawn',
    visualStyle: 'observed-dawn-global-mosaic',
    scientificConfidence: 'observed',
    colorTreatment: 'grayscale',
  },
  vesta: {
    assetPath: 'textures/vesta-dawn-1024.jpg',
    sourceUrl: 'https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_mosaic_60m',
    mission: 'Dawn',
    visualStyle: 'observed-dawn-global-mosaic',
    scientificConfidence: 'observed',
    colorTreatment: 'grayscale',
  },
  pluto: {
    assetPath: 'textures/pluto-new-horizons-1024.jpg',
    sourceUrl:
      'https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m',
    mission: 'New Horizons',
    visualStyle: 'observed-new-horizons-global-mosaic',
    scientificConfidence: 'observed',
    colorTreatment: 'processed-color',
  },
  charon: {
    assetPath: 'textures/charon-new-horizons-1024.jpg',
    sourceUrl:
      'https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m',
    mission: 'New Horizons',
    visualStyle: 'observed-new-horizons-global-mosaic',
    scientificConfidence: 'observed',
    colorTreatment: 'grayscale',
  },
};

export function getObservedSurfaceDefinition(objectId: string): ObservedSurfaceDefinition | null {
  return OBSERVED_SURFACES[objectId] ?? null;
}

function jpl(
  file: string,
  system: string,
  mission: string,
  colorTreatment: ObservedSurfaceDefinition['colorTreatment'],
): ObservedSurfaceDefinition {
  return {
    assetPath: `textures/${file}`,
    sourceUrl: `${JPL_BASE}/${system}.html`,
    mission,
    visualStyle: 'observed-jpl-spacecraft-global-mosaic',
    scientificConfidence: 'observed',
    colorTreatment,
  };
}
