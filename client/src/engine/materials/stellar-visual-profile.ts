export type StellarVisualFamily =
  | 'blue-white'
  | 'white-dwarf'
  | 'yellow-dwarf'
  | 'orange-dwarf'
  | 'red-dwarf'
  | 'red-giant'
  | 'red-supergiant'
  | 'brown-dwarf';

export interface StellarVisualProfile {
  readonly family: StellarVisualFamily;
  readonly shaderIndex: number;
  readonly cellScale: number;
  readonly surfaceContrast: number;
  readonly faculaStrength: number;
  readonly coronaStrength: number;
  readonly spotStrength: number;
  readonly visualScale: number;
}

const PROFILES: Readonly<Record<StellarVisualFamily, StellarVisualProfile>> = {
  'blue-white': {
    family: 'blue-white',
    shaderIndex: 0,
    cellScale: 21,
    surfaceContrast: 0.16,
    faculaStrength: 0.24,
    coronaStrength: 1.2,
    spotStrength: 0.04,
    visualScale: 1.06,
  },
  'white-dwarf': {
    family: 'white-dwarf',
    shaderIndex: 1,
    cellScale: 34,
    surfaceContrast: 0.08,
    faculaStrength: 0.12,
    coronaStrength: 1.35,
    spotStrength: 0.02,
    visualScale: 0.68,
  },
  'yellow-dwarf': {
    family: 'yellow-dwarf',
    shaderIndex: 2,
    cellScale: 26,
    surfaceContrast: 0.27,
    faculaStrength: 0.56,
    coronaStrength: 0.88,
    spotStrength: 0.12,
    visualScale: 1,
  },
  'orange-dwarf': {
    family: 'orange-dwarf',
    shaderIndex: 3,
    cellScale: 18,
    surfaceContrast: 0.38,
    faculaStrength: 0.5,
    coronaStrength: 0.68,
    spotStrength: 0.2,
    visualScale: 0.94,
  },
  'red-dwarf': {
    family: 'red-dwarf',
    shaderIndex: 4,
    cellScale: 11,
    surfaceContrast: 0.52,
    faculaStrength: 0.26,
    coronaStrength: 0.48,
    spotStrength: 0.32,
    visualScale: 0.84,
  },
  'red-giant': {
    family: 'red-giant',
    shaderIndex: 5,
    cellScale: 9,
    surfaceContrast: 0.58,
    faculaStrength: 0.64,
    coronaStrength: 0.7,
    spotStrength: 0.28,
    visualScale: 1.16,
  },
  'red-supergiant': {
    family: 'red-supergiant',
    shaderIndex: 6,
    cellScale: 5,
    surfaceContrast: 0.68,
    faculaStrength: 0.72,
    coronaStrength: 0.82,
    spotStrength: 0.36,
    visualScale: 1.3,
  },
  'brown-dwarf': {
    family: 'brown-dwarf',
    shaderIndex: 7,
    cellScale: 6,
    surfaceContrast: 0.6,
    faculaStrength: 0.08,
    coronaStrength: 0.26,
    spotStrength: 0.44,
    visualScale: 0.7,
  },
};

const RED_SUPERGIANT_PATTERN =
  /^[KM]\d*(?:\.\d+)?(?:-[KM]\d*(?:\.\d+)?)?(?:IAB|IA\+?|IB|I)(?![IV])/u;
const RED_GIANT_PATTERN = /^[KM]\d*(?:\.\d+)?(?:-[KM]\d*(?:\.\d+)?)?(?:III|II)(?!I)/u;

/**
 * Chooses a bounded illustrative surface treatment. Spectral data and B−V remain catalogue facts;
 * these profiles only control procedural granulation, apparent size and glow.
 */
export function getStellarVisualProfile(
  spectralType: string | null,
  colorIndexBv: number,
): StellarVisualProfile {
  const family = visualFamilyFromSpectralType(spectralType);

  return PROFILES[family ?? visualFamilyFromColorIndex(colorIndexBv)];
}

/** Temperature-only fallback for catalogues that do not publish a spectral type. */
export function getStellarVisualProfileFromTemperature(
  temperatureKelvin: number,
): StellarVisualProfile {
  if (!Number.isFinite(temperatureKelvin)) {
    return PROFILES['yellow-dwarf'];
  }
  if (temperatureKelvin >= 7_500) {
    return PROFILES['blue-white'];
  }
  if (temperatureKelvin >= 5_200) {
    return PROFILES['yellow-dwarf'];
  }
  if (temperatureKelvin >= 3_700) {
    return PROFILES['orange-dwarf'];
  }
  if (temperatureKelvin >= 2_400) {
    return PROFILES['red-dwarf'];
  }

  return PROFILES['brown-dwarf'];
}

function visualFamilyFromSpectralType(
  spectralType: string | null,
): StellarVisualFamily | undefined {
  const normalizedType = spectralType?.trim().toUpperCase().replaceAll(' ', '') ?? '';
  const spectralClass = normalizedType[0];

  if (spectralClass === 'D') {
    return 'white-dwarf';
  }
  if (spectralClass === 'L' || spectralClass === 'T' || spectralClass === 'Y') {
    return 'brown-dwarf';
  }
  if (RED_SUPERGIANT_PATTERN.test(normalizedType)) {
    return 'red-supergiant';
  }
  if (RED_GIANT_PATTERN.test(normalizedType)) {
    return 'red-giant';
  }
  if (spectralClass === 'O' || spectralClass === 'B' || spectralClass === 'A') {
    return 'blue-white';
  }
  if (spectralClass === 'F' || spectralClass === 'G') {
    return 'yellow-dwarf';
  }
  if (spectralClass === 'K') {
    return 'orange-dwarf';
  }
  if (spectralClass === 'M') {
    return 'red-dwarf';
  }

  return undefined;
}

function visualFamilyFromColorIndex(colorIndexBv: number): StellarVisualFamily {
  if (!Number.isFinite(colorIndexBv)) {
    return 'yellow-dwarf';
  }
  if (colorIndexBv <= 0.1) {
    return 'blue-white';
  }
  if (colorIndexBv <= 0.85) {
    return 'yellow-dwarf';
  }
  if (colorIndexBv <= 1.45) {
    return 'orange-dwarf';
  }

  return 'red-dwarf';
}
