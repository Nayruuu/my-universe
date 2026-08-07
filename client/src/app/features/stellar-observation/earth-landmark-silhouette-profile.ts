import type { EarthLandmarkCategory } from './earth-landmark-catalog.types';
import type { EarthLandmarkSilhouetteFamily } from './earth-landmark-silhouette';

export interface EarthLandmarkSilhouetteProfile {
  readonly aspectRatio: number;
  readonly family: EarthLandmarkSilhouetteFamily;
}

const DEFAULT_PROFILE_BY_CATEGORY: Readonly<
  Record<EarthLandmarkCategory, EarthLandmarkSilhouetteProfile>
> = {
  architecture: profile('historic-building', 1.6),
  palace: profile('palace', 1.6),
  tower: profile('tower', 0.55),
  monument: profile('monument', 0.8),
  religious: profile('religious', 0.8),
  museum: profile('historic-building', 1.6),
  bridge: profile('bridge', 2.5),
  fortification: profile('historic-building', 1.6),
  civic: profile('historic-building', 1.6),
  venue: profile('stadium', 1.8),
  transport: profile('historic-building', 1.6),
  'public-space': profile('generic-landmark', 1.2),
  'illustrative-cityscape-anchor': profile('generic-landmark', 1.2),
};

const NAME_PROFILES: readonly [RegExp, EarthLandmarkSilhouetteProfile][] = [
  [/\b(cathedral|basilica|abbey|church|minster)\b/iu, profile('cathedral', 1.2)],
  [/\bmosque\b/iu, profile('mosque', 1.45)],
  [/\b(pagoda|stupa)\b/iu, profile('pagoda', 0.78)],
  [/\b(triumphal arch|arc de triomphe|gateway|city gate)\b/iu, profile('triumphal-arch', 1.25)],
  [/\b(obelisk|needle|washington monument)\b/iu, profile('obelisk', 0.34)],
  [/\b(statue|sculpture)\b/iu, profile('statue', 0.62)],
  [/\b(aqueduct|viaduct|arch bridge)\b/iu, profile('arch-bridge', 2.8)],
  [/\bbridge\b/iu, profile('suspension-bridge', 2.8)],
  [
    /\b(skyscraper|high-rise|world trade cent(?:er|re)|headquarters|office tower|hotel tower)\b/iu,
    profile('skyscraper', 0.55),
  ],
];

export function earthLandmarkSilhouetteProfile(
  category: EarthLandmarkCategory,
  name: string,
): EarthLandmarkSilhouetteProfile {
  for (const [pattern, candidateProfile] of NAME_PROFILES) {
    if (pattern.test(name)) {
      return candidateProfile;
    }
  }

  return DEFAULT_PROFILE_BY_CATEGORY[category];
}

function profile(
  family: EarthLandmarkSilhouetteFamily,
  aspectRatio: number,
): EarthLandmarkSilhouetteProfile {
  return { aspectRatio, family };
}
