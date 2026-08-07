import type { CameraOrientation } from '../../../data/models/universe.models';

export type MilkyWayReviewStopId =
  'outer' | 'halo' | 'disc' | 'arms' | 'cloud' | 'solar-neighborhood';

export type MilkyWayReviewLabelKey =
  | 'milkyWayReviewOuter'
  | 'milkyWayReviewHalo'
  | 'milkyWayReviewDisc'
  | 'milkyWayReviewArms'
  | 'milkyWayReviewCloud'
  | 'milkyWayReviewSolarNeighborhood';

export interface MilkyWayReviewStop {
  readonly id: MilkyWayReviewStopId;
  readonly labelKey: MilkyWayReviewLabelKey;
  readonly targetId: 'milky-way' | 'sun';
  readonly zoom: number;
  readonly orientation: CameraOrientation;
}

// These fixed frames bracket the visual hand-offs: distant particle sampling, macroscopic arms,
// local dust and the measured stellar neighbourhood. They deliberately reuse one view direction so
// a review can compare density and colour without a camera-orientation variable.
const REVIEW_ORIENTATION: CameraOrientation = {
  x: 0.630_136,
  y: 0.453_698,
  z: 0.630_136,
};

export const MILKY_WAY_REVIEW_STOPS: readonly MilkyWayReviewStop[] = [
  {
    id: 'outer',
    labelKey: 'milkyWayReviewOuter',
    targetId: 'milky-way',
    zoom: 120_000,
    orientation: REVIEW_ORIENTATION,
  },
  {
    id: 'halo',
    labelKey: 'milkyWayReviewHalo',
    targetId: 'milky-way',
    zoom: 36_000,
    orientation: REVIEW_ORIENTATION,
  },
  {
    id: 'disc',
    labelKey: 'milkyWayReviewDisc',
    targetId: 'milky-way',
    zoom: 9_000,
    orientation: REVIEW_ORIENTATION,
  },
  {
    id: 'arms',
    labelKey: 'milkyWayReviewArms',
    targetId: 'milky-way',
    zoom: 3_600,
    orientation: REVIEW_ORIENTATION,
  },
  {
    id: 'cloud',
    labelKey: 'milkyWayReviewCloud',
    targetId: 'milky-way',
    zoom: 1_200,
    orientation: REVIEW_ORIENTATION,
  },
  {
    id: 'solar-neighborhood',
    labelKey: 'milkyWayReviewSolarNeighborhood',
    targetId: 'sun',
    zoom: 520,
    orientation: REVIEW_ORIENTATION,
  },
];
