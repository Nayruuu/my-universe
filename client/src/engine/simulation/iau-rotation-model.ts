export const IAU_ROTATION_MODEL_SOURCE =
  'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc';

export type IauRotationBody =
  'io' | 'europa' | 'ganymede' | 'callisto' | 'titan' | 'ceres' | 'vesta';

export interface IauRotationAngles {
  rightAscensionDegrees: number;
  declinationDegrees: number;
  primeMeridianDegrees: number;
}

type Polynomial = readonly [constant: number, linear: number, quadratic: number];
type PhaseAngle = readonly [constantDegrees: number, rateDegreesPerCentury: number];

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
  [73.32, 91_472.9],
  [24.62, 45_137.2],
  [283.9, 4_850.7],
  [355.8, 1_191.3],
  [119.9, 262.1],
  [229.8, 64.3],
  [352.25, 2_382.6],
  [113.35, 6_070],
];

const NO_PHASE_ANGLES: readonly PhaseAngle[] = [];
const NO_PERIODIC_TERMS: readonly number[] = [];

// Coefficients are transcribed from NASA/JPL NAIF pck00011.tpc, whose
// principal source is the IAU WGCCRE 2015 report. RA/DEC rates use Julian
// centuries from J2000 TDB; W rates use days from the same epoch.
const IAU_ROTATION_MODELS: Readonly<Record<IauRotationBody, IauRotationModel>> = {
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
  const phaseAngles = model.phaseAngles.map(([constant, rate]) =>
    degreesToRadians(constant + rate * centuriesSinceJ2000),
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
