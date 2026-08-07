import africaPack from '../../../../public/data/earth-landmarks/africa.json';
import americaPack from '../../../../public/data/earth-landmarks/america.json';
import asiaPack from '../../../../public/data/earth-landmarks/asia.json';
import atlanticPack from '../../../../public/data/earth-landmarks/atlantic.json';
import australiaPack from '../../../../public/data/earth-landmarks/australia.json';
import europePack from '../../../../public/data/earth-landmarks/europe.json';
import globalPack from '../../../../public/data/earth-landmarks/global.json';
import indianPack from '../../../../public/data/earth-landmarks/indian.json';
import manifestValue from '../../../../public/data/earth-landmarks/manifest.json';
import pacificPack from '../../../../public/data/earth-landmarks/pacific.json';
import { parseEarthLandmarkManifest, parseEarthLandmarkPack } from './earth-landmark-catalog';

const PACK_BY_REGION: Readonly<Record<string, unknown>> = {
  africa: africaPack,
  america: americaPack,
  asia: asiaPack,
  atlantic: atlanticPack,
  australia: australiaPack,
  europe: europePack,
  global: globalPack,
  indian: indianPack,
  pacific: pacificPack,
};

describe('données statiques des repères terrestres', () => {
  it('valide les packs réellement livrés et leurs 461 lieux', () => {
    const manifest = parseEarthLandmarkManifest(manifestValue);
    let landmarkCount = 0;

    expect(manifest.locationCount).toBe(461);
    expect(new Set(manifest.locationRegionById.keys()).size).toBe(461);
    for (const [regionId, locationIds] of manifest.locationIdsByRegion) {
      const pack = parseEarthLandmarkPack(PACK_BY_REGION[regionId], regionId, locationIds);

      expect(pack.size).toBe(locationIds.length);
      for (const landmarks of pack.values()) {
        expect(landmarks).toHaveLength(4);
        landmarkCount += landmarks.length;
      }
    }
    expect(landmarkCount).toBe(1_844);
  });
});
