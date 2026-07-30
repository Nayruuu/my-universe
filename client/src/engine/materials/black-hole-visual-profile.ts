import { BlackHoleActivity, GraphicQuality } from '../../data/models/universe.models';

export interface BlackHoleVisualProfile {
  activity: BlackHoleActivity;
  showAccretionDisk: boolean;
  showJets: boolean;
  lensingOpacity: number;
  photonRingOpacity: number;
  diskOpacity: number;
  jetOpacity: number;
  lensingScale: number;
  diskScale: number;
  jetLength: number;
  farDiameterScale: number;
  farOpacity: number;
  segmentCount: number;
}

const QUALITY_PROFILE = {
  low: { radiance: 0.68, segmentCount: 18, showJets: false },
  medium: { radiance: 0.84, segmentCount: 32, showJets: true },
  high: { radiance: 1, segmentCount: 48, showJets: true },
} as const satisfies Record<
  GraphicQuality,
  { radiance: number; segmentCount: number; showJets: boolean }
>;

const ACTIVITY_PROFILE = {
  dormant: {
    lensingOpacity: 0.025,
    photonRingOpacity: 0.035,
    diskOpacity: 0,
    jetOpacity: 0,
    lensingScale: 5.4,
    diskScale: 0,
    jetLength: 0,
    farDiameterScale: 5.2,
    farOpacity: 0.46,
  },
  quiescent: {
    lensingOpacity: 0.05,
    photonRingOpacity: 0.24,
    diskOpacity: 0.14,
    jetOpacity: 0,
    lensingScale: 6.1,
    diskScale: 0.95,
    jetLength: 0,
    farDiameterScale: 5.8,
    farOpacity: 0.58,
  },
  active: {
    lensingOpacity: 0.08,
    photonRingOpacity: 0.42,
    diskOpacity: 0.48,
    jetOpacity: 0.045,
    lensingScale: 6.8,
    diskScale: 1.1,
    jetLength: 3.8,
    farDiameterScale: 6.4,
    farOpacity: 0.76,
  },
} as const satisfies Record<
  BlackHoleActivity,
  {
    lensingOpacity: number;
    photonRingOpacity: number;
    diskOpacity: number;
    jetOpacity: number;
    lensingScale: number;
    diskScale: number;
    jetLength: number;
    farDiameterScale: number;
    farOpacity: number;
  }
>;

export function getBlackHoleVisualProfile(
  activity: BlackHoleActivity,
  quality: GraphicQuality,
): BlackHoleVisualProfile {
  const activityProfile = ACTIVITY_PROFILE[activity];
  const qualityProfile = QUALITY_PROFILE[quality];
  const showAccretionDisk = activity !== 'dormant';
  const showJets = activity === 'active' && qualityProfile.showJets;

  return {
    activity,
    showAccretionDisk,
    showJets,
    lensingOpacity: activityProfile.lensingOpacity * qualityProfile.radiance,
    photonRingOpacity: activityProfile.photonRingOpacity * qualityProfile.radiance,
    diskOpacity: showAccretionDisk ? activityProfile.diskOpacity * qualityProfile.radiance : 0,
    jetOpacity: showJets ? activityProfile.jetOpacity * qualityProfile.radiance : 0,
    lensingScale: activityProfile.lensingScale,
    diskScale: activityProfile.diskScale,
    jetLength: activityProfile.jetLength,
    farDiameterScale: activityProfile.farDiameterScale,
    farOpacity: activityProfile.farOpacity * qualityProfile.radiance,
    segmentCount: qualityProfile.segmentCount,
  };
}
