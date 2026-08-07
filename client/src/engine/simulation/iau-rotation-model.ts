export const IAU_ROTATION_MODEL_SOURCE =
  'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc';
export const DAMIT_ROTATION_MODEL_SOURCE = 'https://damit.cuni.cz/pages/documentation';

export type IauRotationBody =
  | 'phobos'
  | 'deimos'
  | 'io'
  | 'europa'
  | 'ganymede'
  | 'callisto'
  | 'titan'
  | 'mimas'
  | 'enceladus'
  | 'tethys'
  | 'dione'
  | 'rhea'
  | 'iapetus'
  | 'miranda'
  | 'ariel'
  | 'umbriel'
  | 'titania'
  | 'oberon'
  | 'triton'
  | 'charon'
  | 'ceres'
  | 'vesta'
  | 'pallas'
  | 'hygiea';

export interface IauRotationAngles {
  rightAscensionDegrees: number;
  declinationDegrees: number;
  primeMeridianDegrees: number;
}

type Polynomial = readonly [constant: number, linear: number, quadratic: number];
type PhaseAngle = readonly [
  constantDegrees: number,
  rateDegreesPerCentury: number,
  quadraticDegreesPerCenturySquared: number,
];

interface IauRotationModel {
  rightAscension: Polynomial;
  declination: Polynomial;
  primeMeridian: Polynomial;
  phaseAngles: readonly PhaseAngle[];
  rightAscensionPeriodic: readonly number[];
  declinationPeriodic: readonly number[];
  primeMeridianPeriodic: readonly number[];
}

const JUPITER_PHASE_ANGLES: readonly PhaseAngle[] = [
  [73.32, 91_472.9, 0],
  [24.62, 45_137.2, 0],
  [283.9, 4_850.7, 0],
  [355.8, 1_191.3, 0],
  [119.9, 262.1, 0],
  [229.8, 64.3, 0],
  [352.25, 2_382.6, 0],
  [113.35, 6_070, 0],
];

const MARS_PHASE_ANGLES: readonly PhaseAngle[] = [
  [190.72646643, 15_917.10818695, 0],
  [21.4689247, 31_834.27934054, 0],
  [332.86082793, 19_139.89694742, 0],
  [394.93256437, 38_280.79631835, 0],
  [189.6327156, 41_215_158.1842005, 12.711923222],
  [121.46893664, 660.22803474, 0],
  [231.05028581, 660.9912354, 0],
  [251.37314025, 1_320.50145245, 0],
  [217.98635955, 38_279.9612555, 0],
  [196.19729402, 19_139.83628608, 0],
];

const SATURN_PHASE_ANGLES: readonly PhaseAngle[] = [
  [353.32, 75_706.7, 0],
  [28.72, 75_706.7, 0],
  [177.4, -36_505.5, 0],
  [300, -7_225.9, 0],
  [316.45, 506.2, 0],
  [345.2, -1_016.3, 0],
  [706.64, 151_413.4, 0],
  [57.44, 151_413.4, 0],
];

const URANUS_PHASE_ANGLES: readonly PhaseAngle[] = [
  [115.75, 54_991.87, 0],
  [141.69, 41_887.66, 0],
  [135.03, 29_927.35, 0],
  [61.77, 25_733.59, 0],
  [249.32, 24_471.46, 0],
  [43.86, 22_278.41, 0],
  [77.66, 20_289.42, 0],
  [157.36, 16_652.76, 0],
  [101.81, 12_872.63, 0],
  [138.64, 8_061.81, 0],
  [102.23, -2_024.22, 0],
  [316.41, 2_863.96, 0],
  [304.01, -51.94, 0],
  [308.71, -93.17, 0],
  [340.82, -75.32, 0],
  [259.14, -504.81, 0],
  [204.46, -4_048.44, 0],
  [632.82, 5_727.92, 0],
];

const NEPTUNE_PHASE_ANGLES: readonly PhaseAngle[] = [
  [357.85, 52.316, 0],
  [323.92, 62_606.6, 0],
  [220.51, 55_064.2, 0],
  [354.27, 46_564.5, 0],
  [75.31, 26_109.4, 0],
  [35.36, 14_325.4, 0],
  [142.61, 2_824.6, 0],
  [177.85, 52.316, 0],
  [647.84, 125_213.2, 0],
  [355.7, 104.632, 0],
  [533.55, 156.948, 0],
  [711.4, 209.264, 0],
  [889.25, 261.58, 0],
  [1_067.1, 313.896, 0],
  [1_244.95, 366.212, 0],
  [1_422.8, 418.528, 0],
  [1_600.65, 470.844, 0],
];

const NO_PHASE_ANGLES: readonly PhaseAngle[] = [];
const NO_PERIODIC_TERMS: readonly number[] = [];

// Most coefficients are transcribed from NASA/JPL NAIF pck00011.tpc, whose principal source is the
// IAU WGCCRE 2015 report. Pallas and Hygiea use the IAUspin files bundled with their 2020 DAMIT
// shape reconstructions. RA/DEC rates use Julian centuries; W rates use days from J2000 TDB.
const IAU_ROTATION_MODELS: Readonly<Record<IauRotationBody, IauRotationModel>> = {
  phobos: {
    rightAscension: [317.67071657, -0.10844326, 0],
    declination: [52.88627266, -0.06134706, 0],
    primeMeridian: [35.1877444, 1_128.84475928, 9.536137031212154e-9],
    phaseAngles: MARS_PHASE_ANGLES,
    rightAscensionPeriodic: [-1.78428399, 0.02212824, -0.01028251, -0.00475595],
    declinationPeriodic: [-1.07516537, 0.00668626, -0.0064874, 0.00281576],
    primeMeridianPeriodic: [1.42421769, -0.02273783, 0.00410711, 0.00631964, -1.143],
  },
  deimos: {
    rightAscension: [316.65705808, -0.10518014, 0],
    declination: [53.50992033, -0.05979094, 0],
    primeMeridian: [79.39932954, 285.16188899, 0],
    phaseAngles: MARS_PHASE_ANGLES,
    rightAscensionPeriodic: [
      0, 0, 0, 0, 0, 3.09217726, 0.22980637, 0.06418655, 0.02533537, 0.00778695,
    ],
    declinationPeriodic: [0, 0, 0, 0, 0, 1.83936004, 0.1432532, 0.01911409, -0.0148259, 0.0019243],
    primeMeridianPeriodic: [
      0, 0, 0, 0, 0, -2.73954829, -0.39968606, -0.06563259, -0.0291294, 0.0169916,
    ],
  },
  io: {
    rightAscension: [268.05, -0.009, 0],
    declination: [64.5, 0.003, 0],
    primeMeridian: [200.39, 203.4889538, 0],
    phaseAngles: JUPITER_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0.094, 0.024],
    declinationPeriodic: [0, 0, 0.04, 0.011],
    primeMeridianPeriodic: [0, 0, -0.085, -0.022],
  },
  europa: {
    rightAscension: [268.08, -0.009, 0],
    declination: [64.51, 0.003, 0],
    primeMeridian: [36.022, 101.3747235, 0],
    phaseAngles: JUPITER_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 1.086, 0.06, 0.015, 0.009],
    declinationPeriodic: [0, 0, 0, 0.468, 0.026, 0.007, 0.002],
    primeMeridianPeriodic: [0, 0, 0, -0.98, -0.054, -0.014, -0.008],
  },
  ganymede: {
    rightAscension: [268.2, -0.009, 0],
    declination: [64.57, 0.003, 0],
    primeMeridian: [44.064, 50.3176081, 0],
    phaseAngles: JUPITER_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, -0.037, 0.431, 0.091],
    declinationPeriodic: [0, 0, 0, -0.016, 0.186, 0.039],
    primeMeridianPeriodic: [0, 0, 0, 0.033, -0.389, -0.082],
  },
  callisto: {
    rightAscension: [268.72, -0.009, 0],
    declination: [64.83, 0.003, 0],
    primeMeridian: [259.51, 21.5710715, 0],
    phaseAngles: JUPITER_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 0, -0.068, 0.59, 0, 0.01],
    declinationPeriodic: [0, 0, 0, 0, -0.029, 0.254, 0, -0.004],
    primeMeridianPeriodic: [0, 0, 0, 0, 0.061, -0.533, 0, -0.009],
  },
  titan: {
    rightAscension: [39.4827, 0, 0],
    declination: [83.4279, 0, 0],
    primeMeridian: [186.5855, 22.5769768, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  mimas: {
    rightAscension: [40.66, -0.036, 0],
    declination: [83.52, -0.004, 0],
    primeMeridian: [333.46, 381.994555, 0],
    phaseAngles: SATURN_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 13.56, 0, 0, 0, 0, 0],
    declinationPeriodic: [0, 0, -1.53, 0, 0, 0, 0, 0],
    primeMeridianPeriodic: [0, 0, -13.48, 0, -44.85, 0, 0, 0],
  },
  enceladus: {
    rightAscension: [40.66, -0.036, 0],
    declination: [83.52, -0.004, 0],
    primeMeridian: [6.32, 262.7318996, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  tethys: {
    rightAscension: [40.66, -0.036, 0],
    declination: [83.52, -0.004, 0],
    primeMeridian: [8.95, 190.6979085, 0],
    phaseAngles: SATURN_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 9.66, 0, 0, 0, 0],
    declinationPeriodic: [0, 0, 0, -1.09, 0, 0, 0, 0],
    primeMeridianPeriodic: [0, 0, 0, -9.6, 2.23, 0, 0, 0],
  },
  dione: {
    rightAscension: [40.66, -0.036, 0],
    declination: [83.52, -0.004, 0],
    primeMeridian: [357.6, 131.5349316, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  rhea: {
    rightAscension: [40.38, -0.036, 0],
    declination: [83.55, -0.004, 0],
    primeMeridian: [235.16, 79.6900478, 0],
    phaseAngles: SATURN_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 0, 0, 3.1, 0, 0],
    declinationPeriodic: [0, 0, 0, 0, 0, -0.35, 0, 0],
    primeMeridianPeriodic: [0, 0, 0, 0, 0, -3.08, 0, 0],
  },
  iapetus: {
    rightAscension: [318.16, -3.949, 0],
    declination: [75.03, -1.143, 0],
    primeMeridian: [355.2, 4.5379572, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  ariel: {
    rightAscension: [257.43, 0, 0],
    declination: [-15.1, 0, 0],
    primeMeridian: [156.22, -142.8356681, 0],
    phaseAngles: URANUS_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.29],
    declinationPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.28],
    primeMeridianPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.08],
  },
  umbriel: {
    rightAscension: [257.43, 0, 0],
    declination: [-15.1, 0, 0],
    primeMeridian: [108.05, -86.8688923, 0],
    phaseAngles: URANUS_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.21],
    declinationPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2],
    primeMeridianPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.09, 0, 0.06],
  },
  titania: {
    rightAscension: [257.43, 0, 0],
    declination: [-15.1, 0, 0],
    primeMeridian: [77.74, -41.3514316, 0],
    phaseAngles: URANUS_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.29],
    declinationPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.28],
    primeMeridianPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.08],
  },
  oberon: {
    rightAscension: [257.43, 0, 0],
    declination: [-15.1, 0, 0],
    primeMeridian: [6.77, -26.7394932, 0],
    phaseAngles: URANUS_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.16],
    declinationPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.16],
    primeMeridianPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.04],
  },
  miranda: {
    rightAscension: [257.43, 0, 0],
    declination: [-15.08, 0, 0],
    primeMeridian: [30.7, -254.6906892, 0],
    phaseAngles: URANUS_PHASE_ANGLES,
    rightAscensionPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4.41, 0, 0, 0, 0, 0, -0.04, 0],
    declinationPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4.25, 0, 0, 0, 0, 0, -0.02, 0],
    primeMeridianPeriodic: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.15, -1.27, 0, 0, 0, 0, -0.09, 0.15],
  },
  triton: {
    rightAscension: [299.36, 0, 0],
    declination: [41.17, 0, 0],
    primeMeridian: [296.53, -61.2572637, 0],
    phaseAngles: NEPTUNE_PHASE_ANGLES,
    rightAscensionPeriodic: [
      0, 0, 0, 0, 0, 0, 0, -32.35, 0, -6.28, -2.08, -0.74, -0.28, -0.11, -0.07, -0.02, -0.01,
    ],
    declinationPeriodic: [0, 0, 0, 0, 0, 0, 0, 22.55, 0, 2.1, 0.55, 0.16, 0.05, 0.02, 0.01, 0, 0],
    primeMeridianPeriodic: [
      0, 0, 0, 0, 0, 0, 0, 22.25, 0, 6.73, 2.05, 0.74, 0.28, 0.11, 0.05, 0.02, 0.01,
    ],
  },
  charon: {
    rightAscension: [132.993, 0, 0],
    declination: [-6.163, 0, 0],
    primeMeridian: [122.695, 56.3625225, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  ceres: {
    rightAscension: [291.418, 0, 0],
    declination: [66.764, 0, 0],
    primeMeridian: [170.65, 952.1532, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  vesta: {
    rightAscension: [309.031, 0, 0],
    declination: [42.235, 0, 0],
    primeMeridian: [285.39, 1_617.3329428, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  pallas: {
    rightAscension: [44, 0, 0],
    declination: [1, 0, 0],
    primeMeridian: [41.7, 1_105.818241, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
  hygiea: {
    rightAscension: [319, 0, 0],
    declination: [-46, 0, 0],
    primeMeridian: [116.5, 624.928069, 0],
    phaseAngles: NO_PHASE_ANGLES,
    rightAscensionPeriodic: NO_PERIODIC_TERMS,
    declinationPeriodic: NO_PERIODIC_TERMS,
    primeMeridianPeriodic: NO_PERIODIC_TERMS,
  },
};

export function isIauRotationBody(objectId: string): objectId is IauRotationBody {
  return Object.hasOwn(IAU_ROTATION_MODELS, objectId);
}

export function calculateIauRotationAngles(
  body: IauRotationBody,
  daysSinceJ2000Tdb: number,
): IauRotationAngles {
  const model = IAU_ROTATION_MODELS[body];
  const centuriesSinceJ2000 = daysSinceJ2000Tdb / 36_525;
  const phaseAngles = model.phaseAngles.map(([constant, rate, quadratic]) =>
    degreesToRadians(constant + rate * centuriesSinceJ2000 + quadratic * centuriesSinceJ2000 ** 2),
  );

  return {
    rightAscensionDegrees:
      evaluatePolynomial(model.rightAscension, centuriesSinceJ2000) +
      evaluatePeriodicTerms(model.rightAscensionPeriodic, phaseAngles, Math.sin),
    declinationDegrees:
      evaluatePolynomial(model.declination, centuriesSinceJ2000) +
      evaluatePeriodicTerms(model.declinationPeriodic, phaseAngles, Math.cos),
    primeMeridianDegrees: normalizeDegrees(
      evaluatePolynomial(model.primeMeridian, daysSinceJ2000Tdb) +
        evaluatePeriodicTerms(model.primeMeridianPeriodic, phaseAngles, Math.sin),
    ),
  };
}

function evaluatePolynomial([constant, linear, quadratic]: Polynomial, argument: number): number {
  return constant + linear * argument + quadratic * argument * argument;
}

function evaluatePeriodicTerms(
  coefficients: readonly number[],
  phaseAngles: readonly number[],
  trigonometricFunction: (angle: number) => number,
): number {
  return coefficients.reduce(
    (sum, coefficient, index) => sum + coefficient * trigonometricFunction(phaseAngles[index]!),
    0,
  );
}

function degreesToRadians(value: number): number {
  return value * (Math.PI / 180);
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
