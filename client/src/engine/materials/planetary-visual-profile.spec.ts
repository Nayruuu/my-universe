import { getPlanetaryVisualProfile } from './planetary-visual-profile';

describe('planetary visual profiles', () => {
  it('keeps the low profile lightweight while preserving a readable atmosphere', () => {
    expect(getPlanetaryVisualProfile('low')).toEqual({
      photographicTextureResolution: 1024,
      proceduralTextureWidth: 0,
      textureAnisotropy: 1,
      showEarthClouds: false,
      showEarthNightLights: false,
      showGasGiantStorms: false,
      atmosphereIntensity: 0.72,
    });
  });

  it('adds the photographic Earth layers and gas-giant storms at medium quality', () => {
    expect(getPlanetaryVisualProfile('medium')).toEqual({
      photographicTextureResolution: 1024,
      proceduralTextureWidth: 512,
      textureAnisotropy: 2,
      showEarthClouds: true,
      showEarthNightLights: true,
      showGasGiantStorms: true,
      atmosphereIntensity: 0.88,
    });
  });

  it('raises texture detail without changing the layer semantics at high quality', () => {
    expect(getPlanetaryVisualProfile('high')).toEqual({
      photographicTextureResolution: 2048,
      proceduralTextureWidth: 768,
      textureAnisotropy: 4,
      showEarthClouds: true,
      showEarthNightLights: true,
      showGasGiantStorms: true,
      atmosphereIntensity: 1,
    });
  });
});
