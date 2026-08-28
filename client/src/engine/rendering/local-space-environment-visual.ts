import * as THREE from 'three';

export const LOCAL_MILKY_WAY_PANORAMA_URL = '/textures/milky-way-eso-band-8k-v3.webp';
export const LOCAL_MILKY_WAY_SOURCE_PAGE_URL = 'https://www.eso.org/public/images/eso0932a/';

export interface LocalSpaceCinematicProfile {
  readonly galacticDetail: number;
  readonly zodiacalGrain: number;
  readonly coronaRayStrength: number;
}

export interface LocalSpaceEnvironmentVisual {
  readonly galacticBandGeometry: THREE.SphereGeometry;
  readonly galacticBandMaterial: THREE.ShaderMaterial;
  readonly galacticBand: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly zodiacalGeometry: THREE.CircleGeometry;
  readonly zodiacalMaterial: THREE.ShaderMaterial;
  readonly zodiacalLight: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  readonly coronaTexture: THREE.DataTexture;
  readonly coronaMaterial: THREE.SpriteMaterial;
  readonly solarCorona: THREE.Sprite;
}

const GALACTIC_BAND_PANORAMA_EXPOSURE = 1.18;
const GALACTIC_BAND_PRESENTATION_PITCH_DEGREES = 0;
const GALACTIC_BAND_PRESENTATION_ROLL_DEGREES = 0;
const GALACTIC_SKY_RADIUS = 64_000;
const ZODIACAL_LIGHT_RADIUS = 480;
const SOLAR_CORONA_TEXTURE_SIZE = 192;

export function createLocalSpaceEnvironmentVisual(
  profile: LocalSpaceCinematicProfile,
): LocalSpaceEnvironmentVisual {
  const galacticBandGeometry = new THREE.SphereGeometry(GALACTIC_SKY_RADIUS, 64, 32);
  const galacticBandMaterial = createGalacticBandMaterial(profile.galacticDetail);
  const galacticBand = new THREE.Mesh(galacticBandGeometry, galacticBandMaterial);
  const zodiacalGeometry = new THREE.CircleGeometry(1, 96);
  const zodiacalMaterial = createZodiacalLightMaterial(profile.zodiacalGrain);
  const zodiacalLight = new THREE.Mesh(zodiacalGeometry, zodiacalMaterial);
  const coronaTexture = createSolarCoronaTexture();
  const coronaMaterial = createSolarCoronaMaterial(coronaTexture);
  const solarCorona = new THREE.Sprite(coronaMaterial);
  const visual = {
    galacticBandGeometry,
    galacticBandMaterial,
    galacticBand,
    zodiacalGeometry,
    zodiacalMaterial,
    zodiacalLight,
    coronaTexture,
    coronaMaterial,
    solarCorona,
  };

  configureGalacticBand(galacticBand);
  configureZodiacalLight(zodiacalLight);
  configureSolarCorona(solarCorona);
  applyLocalSpaceVisualProfile(visual, profile);

  return visual;
}

export function applyLocalSpaceVisualProfile(
  visual: LocalSpaceEnvironmentVisual,
  profile: LocalSpaceCinematicProfile,
): void {
  visual.galacticBandMaterial.uniforms['detailStrength']!.value = profile.galacticDetail;
  visual.zodiacalMaterial.uniforms['grainStrength']!.value = profile.zodiacalGrain;
  visual.coronaMaterial.color.setRGB(
    1,
    0.82 + profile.coronaRayStrength * 0.14,
    0.66 + profile.coronaRayStrength * 0.26,
  );
}

export function configureLocalPanoramaTexture(
  texture: THREE.Texture,
  wrapS: THREE.Wrapping,
  anisotropy: number,
): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = wrapS;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
}

function configureGalacticBand(
  galacticBand: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>,
): void {
  galacticBand.name = 'illustrative-local-milky-way-sky';
  galacticBand.visible = false;
  galacticBand.frustumCulled = false;
  galacticBand.renderOrder = -9_000;
  galacticBand.rotation.x = THREE.MathUtils.degToRad(GALACTIC_BAND_PRESENTATION_PITCH_DEGREES);
  galacticBand.rotation.z = THREE.MathUtils.degToRad(GALACTIC_BAND_PRESENTATION_ROLL_DEGREES);
  galacticBand.userData['scientificConfidence'] = 'illustrative';
  galacticBand.userData['physicalPhenomenon'] = 'integrated-milky-way-light-and-dust';
  galacticBand.userData['referenceFrame'] = 'galactic-heliocentric';
  galacticBand.userData['panoramaUrl'] = LOCAL_MILKY_WAY_PANORAMA_URL;
  galacticBand.userData['galacticCenterDirection'] = [-1, 0, 0];
  galacticBand.userData['visualStyle'] = 'inside-milky-way-panoramic-band';
  galacticBand.userData['angularPresentation'] = 'distant-thin-sky-band';
  galacticBand.userData['observerAnchoring'] = 'camera-centered-distant-sphere';
  galacticBand.userData['sourceCredit'] = 'ESO/S. Brunier';
  galacticBand.userData['sourceImageId'] = 'ESO-ESO0932A';
  galacticBand.userData['sourcePageUrl'] = LOCAL_MILKY_WAY_SOURCE_PAGE_URL;
  galacticBand.userData['sourcePixelDimensions'] = [6_000, 3_000];
  galacticBand.userData['texturePixelDimensions'] = [8_192, 1_024];
  galacticBand.userData['sourceAngularLatitudeSpanDegrees'] = 60;
  galacticBand.userData['angularLatitudeSpanDegrees'] = 32;
  galacticBand.userData['latitudePresentationScale'] = 32 / 60;
  galacticBand.userData['visibilityTreatment'] =
    'photographic-interior-crossfade-with-density-volume';
  galacticBand.userData['displayGrade'] = 'eso-photographic-neutral-warm-v4';
  galacticBand.userData['sourceProjection'] = 'full-sky-panorama-galactic-plane-horizontal';
  galacticBand.userData['presentationPitchDegrees'] = GALACTIC_BAND_PRESENTATION_PITCH_DEGREES;
  galacticBand.userData['presentationRollDegrees'] = GALACTIC_BAND_PRESENTATION_ROLL_DEGREES;
  galacticBand.userData['presentationComposition'] = 'shared-galactic-plane-with-density-volume';
  galacticBand.userData['orientationConfidence'] = 'calculated-shared-galactic-frame';
  galacticBand.userData['photographicSourceConfidence'] = 'observed';
  galacticBand.userData['visualLayers'] = [
    'integrated-starlight',
    'central-bulge',
    'dust-rifts',
    'star-forming-clouds',
  ];
}

function configureZodiacalLight(
  zodiacalLight: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>,
): void {
  zodiacalLight.name = 'illustrative-zodiacal-light';
  zodiacalLight.visible = false;
  zodiacalLight.rotation.x = -Math.PI / 2;
  zodiacalLight.scale.setScalar(ZODIACAL_LIGHT_RADIUS);
  zodiacalLight.renderOrder = 0;
  zodiacalLight.userData['scientificConfidence'] = 'illustrative';
  zodiacalLight.userData['physicalPhenomenon'] = 'zodiacal-dust-scattering';
  zodiacalLight.userData['referencePlane'] = 'ecliptic-approximation';
}

function configureSolarCorona(solarCorona: THREE.Sprite): void {
  solarCorona.name = 'illustrative-solar-corona';
  solarCorona.visible = false;
  solarCorona.renderOrder = 3;
  solarCorona.userData['scientificConfidence'] = 'illustrative';
  solarCorona.userData['physicalPhenomenon'] = 'solar-corona-and-diffraction';
}

function createGalacticBandMaterial(detailStrength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      radiance: { value: 1 },
      detailStrength: { value: detailStrength },
      panorama: { value: null },
      panoramaReady: { value: 0 },
      panoramaBlend: { value: 0 },
      panoramaExposure: { value: GALACTIC_BAND_PANORAMA_EXPOSURE },
    },
    vertexShader: `
      varying vec3 galacticDirection;

      void main() {
        galacticDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float radiance;
      uniform float detailStrength;
      uniform sampler2D panorama;
      uniform float panoramaReady;
      uniform float panoramaBlend;
      uniform float panoramaExposure;
      varying vec3 galacticDirection;

      float layeredCloud(vec2 coordinate) {
        float broad = sin(coordinate.x) * sin(coordinate.y);
        float middle = sin(coordinate.x * 2.13 + coordinate.y * 1.37);
        float fine = sin(coordinate.x * 4.71 - coordinate.y * 3.19);

        return 0.5 + 0.5 * (broad * 0.48 + middle * 0.33 + fine * 0.19);
      }

      void main() {
        vec3 direction = normalize(galacticDirection);
        float galacticLatitude = abs(direction.y);
        float longitude = atan(direction.z, -direction.x);
        float galacticCenter = pow(max(0.0, dot(direction, vec3(-1.0, 0.0, 0.0))), 3.1);
        float antiCenter = pow(max(0.0, dot(direction, vec3(1.0, 0.0, 0.0))), 2.0);
        float latitudeWarp = direction.y
          + sin(longitude * 2.0 + 0.7) * 0.018
          + sin(longitude * 5.0 - 1.2) * 0.007 * detailStrength;
        float warpedLatitude = abs(latitudeWarp);
        float broadBand = exp(-warpedLatitude * 5.6);
        float brightCore = exp(-warpedLatitude * 16.0);
        float cloud = layeredCloud(vec2(longitude * 3.6 + 1.4, latitudeWarp * 31.0));
        float starCloud = smoothstep(0.28, 0.82, cloud)
          * layeredCloud(vec2(longitude * 8.1 - 2.0, latitudeWarp * 67.0));
        float dustLane = exp(-abs(latitudeWarp + sin(longitude * 3.0) * 0.006) * 48.0);
        float dustRift = dustLane
          * smoothstep(0.32, 0.8, layeredCloud(vec2(longitude * 6.7, latitudeWarp * 82.0 + 3.0)));
        float centerBulge = galacticCenter * exp(-warpedLatitude * 8.5);
        float emission = broadBand * (0.17 + starCloud * 0.18 * detailStrength)
          + brightCore * (0.1 + centerBulge * 0.62 + antiCenter * 0.05);

        emission *= 1.0 - dustRift * (0.58 + detailStrength * 0.26);
        vec3 coolColor = vec3(0.12, 0.19, 0.3);
        vec3 neutralColor = vec3(0.46, 0.46, 0.44);
        vec3 warmColor = vec3(0.72, 0.48, 0.29);
        vec3 proceduralColor = mix(coolColor, neutralColor, starCloud * 0.76);
        proceduralColor = mix(proceduralColor, warmColor, centerBulge * 0.82);
        proceduralColor += vec3(0.08, 0.12, 0.15) * starCloud * brightCore * detailStrength;
        float proceduralAlpha = clamp(emission * opacity * 1.65, 0.0, 0.72);
        float latitudeAngle = asin(clamp(direction.y, -1.0, 1.0));
        float bandLatitudeWindow = 1.0 - smoothstep(0.26179938780, 0.27925268032, abs(latitudeAngle));
        vec2 panoramaUv = vec2(
          fract(0.5 - longitude / 6.28318530718),
          clamp(0.5 + latitudeAngle / 0.55850536064, 0.001, 0.999)
        );
        vec2 atlasUv = panoramaUv;
        vec3 panoramaColor = texture2D(panorama, atlasUv).rgb;
        float panoramaLuminance = dot(panoramaColor, vec3(0.2126, 0.7152, 0.0722));
        float panoramaSignal = smoothstep(0.006, 0.22, panoramaLuminance);
        float photographicCoverage = smoothstep(0.0025, 0.12, panoramaLuminance);
        float panoramaAlpha = opacity
          * clamp(photographicCoverage * 0.88 + panoramaSignal * 0.18, 0.0, 0.96)
          * bandLatitudeWindow;

        panoramaColor = pow(max(panoramaColor, vec3(0.0)), vec3(0.94));
        vec3 panoramaGray = vec3(dot(panoramaColor, vec3(0.2126, 0.7152, 0.0722)));
        panoramaColor = max(mix(panoramaGray, panoramaColor, 1.12), vec3(0.0));
        panoramaColor *= vec3(1.03, 1.0, 0.95);
        panoramaColor *= mix(1.0, panoramaExposure, panoramaSignal);
        float photographicMix = panoramaReady * panoramaBlend;
        vec3 color = mix(proceduralColor, panoramaColor, photographicMix);
        float alpha = mix(proceduralAlpha, panoramaAlpha, photographicMix);

        if (alpha < 0.001) {
          discard;
        }
        gl_FragColor = vec4(color * radiance * (0.88 + emission * 0.32), alpha);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
}

function createZodiacalLightMaterial(grainStrength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      radiance: { value: 1 },
      grainStrength: { value: grainStrength },
    },
    vertexShader: `
      varying vec2 localPosition;

      void main() {
        localPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float radiance;
      uniform float grainStrength;
      varying vec2 localPosition;

      void main() {
        float radius = length(localPosition);
        if (radius > 1.0) {
          discard;
        }
        float angle = atan(localPosition.y, localPosition.x);
        float radialFade = pow(max(0.0, 1.0 - radius), 2.45);
        float innerGlow = exp(-radius * 7.5);
        float grain = 0.72 + 0.28 * sin(angle * 19.0 + radius * 54.0);
        grain = mix(1.0, grain, grainStrength);
        float alpha = (radialFade * 0.42 + innerGlow * 0.58) * grain * opacity;
        vec3 color = mix(vec3(0.36, 0.2, 0.1), vec3(1.0, 0.64, 0.28), innerGlow);

        if (alpha < 0.001) {
          discard;
        }
        gl_FragColor = vec4(color * radiance, alpha);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSolarCoronaMaterial(texture: THREE.Texture): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: texture,
    color: 0xffe1a8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSolarCoronaTexture(): THREE.DataTexture {
  const size = SOLAR_CORONA_TEXTURE_SIZE;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      writeCoronaPixel(pixels, size, x, y);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);

  texture.name = 'procedural-solar-corona';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.userData['scientificConfidence'] = 'illustrative';
  texture.userData['visualLayers'] = ['warmCore', 'softHalo', 'coronaRays'];

  return texture;
}

function writeCoronaPixel(pixels: Uint8Array, size: number, x: number, y: number): void {
  const normalizedX = ((x + 0.5) / size) * 2 - 1;
  const normalizedY = ((y + 0.5) / size) * 2 - 1;
  const radius = Math.hypot(normalizedX, normalizedY);
  const angle = Math.atan2(normalizedY, normalizedX);
  const core = Math.max(0, 1 - radius / 0.2);
  const halo = Math.max(0, 1 - radius);
  const primaryRays = Math.pow(Math.max(0, Math.cos(angle * 6)), 12);
  const secondaryRays = Math.pow(Math.max(0, Math.cos(angle * 11 + 0.7)), 18);
  const rayEnvelope = Math.max(0, 1 - radius) * smoothstep(0.12, 0.74, radius);
  const alpha = THREE.MathUtils.clamp(
    Math.pow(halo, 2.35) * 0.72 +
      core * 0.9 +
      (primaryRays * 0.2 + secondaryRays * 0.1) * rayEnvelope,
    0,
    1,
  );
  const offset = (y * size + x) * 4;

  pixels[offset] = 255;
  pixels[offset + 1] = Math.round(225 + core * 30);
  pixels[offset + 2] = Math.round(165 + core * 80);
  pixels[offset + 3] = Math.round(alpha * 255);
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}
