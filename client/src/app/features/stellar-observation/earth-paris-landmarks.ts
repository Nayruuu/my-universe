export const PARIS_PANORAMA_WIDTH = 7_200;
export const PARIS_PANORAMA_HEIGHT = 320;
export const PARIS_EIFFEL_TOWER_HEIGHT_METERS = 330;
export const PARIS_EIFFEL_VISUAL_SCALE = 1.82;

const LANDMARK_BASE_RENDERED_HEIGHT_PX = 88;

export const PARIS_EIFFEL_RENDERED_HEIGHT_PX =
  LANDMARK_BASE_RENDERED_HEIGHT_PX * PARIS_EIFFEL_VISUAL_SCALE;

export interface ParisLandmarkDefinition {
  readonly id: 'notre-dame' | 'montparnasse' | 'grande-arche' | 'arc-de-triomphe' | 'sacre-coeur';
  readonly className: string;
  readonly sourceHref: string;
  readonly sourceViewBox: string;
  readonly sourceAspectRatio: number;
  readonly centerX: number;
  readonly heightMeters: number;
  readonly baseElevationMeters: number;
}

export interface ParisLandmarkLayout extends ParisLandmarkDefinition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const PARIS_LANDMARKS: readonly ParisLandmarkDefinition[] = [
  {
    id: 'notre-dame',
    className: 'earth-cityscape__notre-dame',
    sourceHref: '/illustrations/highpoints-of-paris.svg#g21514',
    sourceViewBox: '695 280 54 72',
    sourceAspectRatio: 54 / 72,
    centerX: 2_904,
    heightMeters: 69,
    baseElevationMeters: 0,
  },
  {
    id: 'montparnasse',
    className: 'earth-cityscape__montparnasse',
    sourceHref: '/illustrations/highpoints-of-paris.svg#g7527',
    sourceViewBox: '221 140 63 211',
    sourceAspectRatio: 63 / 211,
    centerX: 4_771.5,
    heightMeters: 210,
    baseElevationMeters: 0,
  },
  {
    id: 'grande-arche',
    className: 'earth-cityscape__grande-arche',
    sourceHref: '/illustrations/highpoints-of-paris.svg#g22418',
    sourceViewBox: '395 241 109 111',
    sourceAspectRatio: 109 / 111,
    centerX: 5_355,
    heightMeters: 110,
    baseElevationMeters: 0,
  },
  {
    id: 'arc-de-triomphe',
    className: 'earth-cityscape__arc',
    sourceHref: '/illustrations/highpoints-of-paris.svg#g20551',
    sourceViewBox: '864 293 60 58',
    sourceAspectRatio: 60 / 58,
    centerX: 5_932.5,
    heightMeters: 49.54,
    baseElevationMeters: 0,
  },
  {
    id: 'sacre-coeur',
    className: 'earth-cityscape__sacre-coeur',
    sourceHref: '/illustrations/highpoints-of-paris.svg#g16954',
    sourceViewBox: '557 145 108 87',
    sourceAspectRatio: 108 / 87,
    centerX: 6_945,
    heightMeters: 83,
    baseElevationMeters: 130,
  },
];

export function projectParisLandmarkLayouts(
  panoramaUnitsPerRenderedPixel: number,
): readonly ParisLandmarkLayout[] {
  const unitsPerPixel =
    Number.isFinite(panoramaUnitsPerRenderedPixel) && panoramaUnitsPerRenderedPixel > 0
      ? panoramaUnitsPerRenderedPixel
      : 1;
  const panoramaUnitsPerMeter =
    (PARIS_EIFFEL_RENDERED_HEIGHT_PX / PARIS_EIFFEL_TOWER_HEIGHT_METERS) * unitsPerPixel;

  return PARIS_LANDMARKS.map((landmark) => {
    const height = landmark.heightMeters * panoramaUnitsPerMeter;
    const width = height * landmark.sourceAspectRatio;
    const baseElevation = landmark.baseElevationMeters * panoramaUnitsPerMeter;

    return {
      ...landmark,
      x: landmark.centerX - width / 2,
      y: PARIS_PANORAMA_HEIGHT - height - baseElevation,
      width,
      height,
    };
  });
}
