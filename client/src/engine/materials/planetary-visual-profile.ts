import { GraphicQuality } from '../../data/models/universe.models';

export interface PlanetaryVisualProfile {
  photographicTextureResolution: 1024 | 2048;
  proceduralTextureWidth: 0 | 512 | 768;
  textureAnisotropy: 1 | 2 | 4;
  showEarthClouds: boolean;
  showEarthNightLights: boolean;
  showGasGiantStorms: boolean;
  atmosphereIntensity: number;
}

const PROFILES: Readonly<Record<GraphicQuality, PlanetaryVisualProfile>> = {
  low: {
    photographicTextureResolution: 1024,
    proceduralTextureWidth: 0,
    textureAnisotropy: 1,
    showEarthClouds: false,
    showEarthNightLights: false,
    showGasGiantStorms: false,
    atmosphereIntensity: 0.72,
  },
  medium: {
    photographicTextureResolution: 1024,
    proceduralTextureWidth: 512,
    textureAnisotropy: 2,
    showEarthClouds: true,
    showEarthNightLights: true,
    showGasGiantStorms: true,
    atmosphereIntensity: 0.88,
  },
  high: {
    photographicTextureResolution: 2048,
    proceduralTextureWidth: 768,
    textureAnisotropy: 4,
    showEarthClouds: true,
    showEarthNightLights: true,
    showGasGiantStorms: true,
    atmosphereIntensity: 1,
  },
};

export function getPlanetaryVisualProfile(quality: GraphicQuality): PlanetaryVisualProfile {
  return PROFILES[quality];
}
