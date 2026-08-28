import * as THREE from 'three';
import {
  getMilkyWayProceduralVolumeProfile,
  MilkyWayProceduralVolume,
} from './milky-way-procedural-volume';

describe('MilkyWayProceduralVolume', () => {
  it('encode un champ de densité RGBA illustratif et adapte le lancer de rayons', () => {
    const volume = new MilkyWayProceduralVolume(11_400, 1_100);
    const texture = volume.material.uniforms['densityTexture']!.value as THREE.Data3DTexture;
    const image = texture.image as {
      data: Uint8Array;
      width: number;
      height: number;
      depth: number;
    };
    const low = getMilkyWayProceduralVolumeProfile('low');
    const medium = getMilkyWayProceduralVolumeProfile('medium');
    const high = getMilkyWayProceduralVolumeProfile('high');

    expect(volume.mesh.name).toBe('milky-way-procedural-density-volume');
    expect(volume.mesh.scale.toArray()).toEqual([5_700, 550, 5_700]);
    expect(volume.mesh.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      representationTechnique: 'procedural-three-dimensional-density-volume',
      densityResolution: [192, 48, 192],
      spiralStructure: 'two-major-and-two-secondary-cloudy-arms',
      dustTreatment: 'leading-edge-rifts-plus-inner-filaments-and-bar-dust-lanes',
      colorStructure:
        'warm-ivory-integrated-light-sapphire-young-stars-amber-bar-black-dust-and-magenta-hii',
      densityTreatment: 'clustered-branched-starlight-with-dark-interarm-gaps',
      integratedLightTreatment:
        'unresolved-stellar-light-structured-into-arms-filaments-and-clumps',
      localSpurTreatment: 'illustrative-branch-anchored-at-the-solar-galactocentric-radius',
      visualReferences: [
        'NASA/JPL-Caltech/R. Hurt Milky Way structure',
        'NASA/JPL-Caltech/ESO/R. Hurt VISTA bulge impression',
        'ESO Milky Way central panorama',
      ],
      quality: 'medium',
    });
    expect(texture.format).toBe(THREE.RGBAFormat);
    expect(image.width).toBe(192);
    expect(image.height).toBe(48);
    expect(image.depth).toBe(192);
    expect(image.data).toHaveLength(192 * 48 * 192 * 4);
    expect(image.data.some((value, index) => index % 4 === 0 && value > 0)).toBe(true);
    expect(image.data.some((value, index) => index % 4 === 1 && value > 0)).toBe(true);
    expect(image.data.some((value, index) => index % 4 === 2 && value > 0)).toBe(true);
    expect(image.data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    const midplaneEmission = averageChannelSlice(
      image.data,
      image.width,
      image.height,
      image.depth,
      Math.floor(image.height / 2),
      0,
    );
    const thickDiscEmission = averageChannelSlice(
      image.data,
      image.width,
      image.height,
      image.depth,
      8,
      0,
    );
    const darkMidplaneFraction = fractionOfChannelDiscSlice(
      image.data,
      image.width,
      image.height,
      image.depth,
      Math.floor(image.height / 2),
      0,
      (value) => value <= 8,
    );
    const structuredMidplaneFraction = fractionOfChannelDiscSlice(
      image.data,
      image.width,
      image.height,
      image.depth,
      Math.floor(image.height / 2),
      0,
      (value) => value >= 32,
    );

    expect(thickDiscEmission).toBeGreaterThan(midplaneEmission * 0.015);
    expect(thickDiscEmission).toBeLessThan(midplaneEmission * 0.12);
    expect(darkMidplaneFraction).toBeGreaterThan(0.5);
    expect(structuredMidplaneFraction).toBeGreaterThan(0.04);
    expect(structuredMidplaneFraction).toBeLessThan(0.12);
    expect(low.rayMarchSteps).toBeLessThan(medium.rayMarchSteps);
    expect(medium.rayMarchSteps).toBeLessThan(high.rayMarchSteps);
    expect(low.dustAbsorption).toBeLessThan(high.dustAbsorption);
    expect(low.brightness).toBeLessThan(high.brightness);

    volume.setQuality('high');
    expect(volume.material.uniforms['rayMarchSteps']!.value).toBe(high.rayMarchSteps);
    expect(volume.material.uniforms['absorption']!.value).toBe(high.absorption);
    expect(volume.material.uniforms['dustAbsorption']!.value).toBe(high.dustAbsorption);
    expect(volume.material.uniforms['brightness']!.value).toBe(high.brightness);
    expect(volume.material.fragmentShader).toContain('MAXIMUM_STEPS = 32');
    expect(volume.material.fragmentShader).toContain('insideVolume');
    expect(volume.material.fragmentShader).toContain('sampler3D');
    expect(volume.material.fragmentShader).toContain('stellarEmission');
    expect(volume.material.fragmentShader).toContain('pow(densitySample.r, 1.18)');
    expect(volume.material.fragmentShader).toContain('youngStarTint');
    expect(volume.material.fragmentShader).toContain('warmTint');
    expect(volume.material.fragmentShader).toContain('neutralStarlight');
    expect(volume.material.fragmentShader).toContain('vec3 blueStars = vec3(0.16, 0.4, 0.9)');
    expect(volume.material.fragmentShader).toContain('vec3 warmCore = vec3(0.98, 0.5, 0.16)');
    expect(volume.material.fragmentShader).toContain('brownDust');
    expect(volume.material.fragmentShader).toContain('pinkNebula');
    expect(volume.material.fragmentShader).toContain('nebulaNoise');
    expect(volume.material.fragmentShader).toContain('inclinationCompensation');
    expect(volume.material.fragmentShader).toContain('mix(1.0, 0.86, faceOnFactor)');

    volume.dispose();
  });

  it('masque le volume transparent, transmet sa radiance et libère ses ressources', () => {
    const volume = new MilkyWayProceduralVolume(11_400, 1_100);
    const texture = volume.material.uniforms['densityTexture']!.value as THREE.Data3DTexture;
    const textureDispose = vi.spyOn(texture, 'dispose');
    const geometryDispose = vi.spyOn(volume.mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(volume.material, 'dispose');

    volume.update(0, 0.7);
    expect(volume.mesh.visible).toBe(false);
    expect(volume.material.uniforms['volumeOpacity']!.value).toBe(0);
    expect(volume.material.uniforms['radiance']!.value).toBe(0.7);

    volume.update(0.82, 1.3);
    expect(volume.mesh.visible).toBe(true);
    expect(volume.material.uniforms['volumeOpacity']!.value).toBe(0.82);
    expect(volume.material.uniforms['radiance']!.value).toBe(1.3);

    volume.dispose();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});

function averageChannelSlice(
  data: Uint8Array,
  width: number,
  height: number,
  depth: number,
  yIndex: number,
  channel: number,
): number {
  let total = 0;

  for (let zIndex = 0; zIndex < depth; zIndex += 1) {
    for (let xIndex = 0; xIndex < width; xIndex += 1) {
      total += data[((zIndex * height + yIndex) * width + xIndex) * 4 + channel]!;
    }
  }

  return total / (width * depth);
}

function fractionOfChannelDiscSlice(
  data: Uint8Array,
  width: number,
  height: number,
  depth: number,
  yIndex: number,
  channel: number,
  predicate: (value: number) => boolean,
): number {
  let matching = 0;
  let sampleCount = 0;

  for (let zIndex = 0; zIndex < depth; zIndex += 1) {
    for (let xIndex = 0; xIndex < width; xIndex += 1) {
      const x = normalizedCoordinate(xIndex, width);
      const z = normalizedCoordinate(zIndex, depth);

      if (Math.hypot(x, z) >= 0.94) {
        continue;
      }
      const value = data[((zIndex * height + yIndex) * width + xIndex) * 4 + channel]!;

      sampleCount += 1;
      if (predicate(value)) {
        matching += 1;
      }
    }
  }

  return matching / sampleCount;
}

function normalizedCoordinate(index: number, size: number): number {
  return (index / (size - 1)) * 2 - 1;
}
