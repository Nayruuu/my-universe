import * as THREE from 'three';
import { GraphicQuality } from '../../data/models/universe.models';
import { colorIndexToRgb } from '../materials/star-color';
import { applyStellarPhotosphereAppearance } from '../materials/stellar-photosphere-material';
import {
  STELLAR_PROFILE_TINT_GLSL,
  STELLAR_SPRITE_SURFACE_GLSL,
} from '../materials/stellar-surface-shader';
import { getStellarVisualProfile } from '../materials/stellar-visual-profile';
import { CATALOG_STAR_VISUAL_RADIUS, StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';

const CATALOG_PICKING_PRIORITY = 20;
const SELECTED_STAR_PICKING_PRIORITY = 30;

const OPTICAL_PROFILE_BY_QUALITY = {
  low: {
    diffractionStrength: 0,
    airyStrength: 0,
    granulationStrength: 0.08,
    surfaceDetail: 0.38,
  },
  medium: {
    diffractionStrength: 0.32,
    airyStrength: 0.14,
    granulationStrength: 0.18,
    surfaceDetail: 0.72,
  },
  high: {
    diffractionStrength: 0.5,
    airyStrength: 0.26,
    granulationStrength: 0.28,
    surfaceDetail: 1,
  },
} as const satisfies Readonly<
  Record<
    GraphicQuality,
    {
      diffractionStrength: number;
      airyStrength: number;
      granulationStrength: number;
      surfaceDetail: number;
    }
  >
>;

export interface StarCatalogVisual {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly activeDetail: THREE.Group;
  readonly activeHalo: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly activeCore: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly visibleIndices: Uint8Array;
}

export function createStarCatalogVisual(registry: StarCatalogRegistry): StarCatalogVisual {
  const catalog = registry.catalog;
  const visibleIndices = new Uint8Array(catalog.count);
  const points = new THREE.Points(createGeometry(registry), createMaterial());
  const selectionPoint = createSelectionPoint();
  const activeDetail = new THREE.Group();
  const activeHalo = createActiveHalo();
  const activeCore = createActiveCore();

  points.name = 'observed-hyg-star-catalog';
  points.layers.enable(PICKING_LAYER);
  selectionPoint.layers.enable(PICKING_LAYER);
  points.visible = false;
  points.renderOrder = 2;
  points.userData['catalogCount'] = catalog.count;
  points.userData['referenceEpochJulianDay'] = catalog.referenceEpochJulianDay;
  points.userData['scientificConfidence'] = 'observed';
  points.userData['visualScale'] = 'compressed';
  points.userData['objectIds'] = registry.objectIds;
  points.userData['visibleIndices'] = visibleIndices;
  points.userData['appearanceConfidence'] = 'illustrative';
  points.userData['visualStyle'] = 'procedural-spectral-photospheres-v3';
  points.userData['observerBoundaryOpacity'] = 1;
  points.userData['pickingPriority'] = CATALOG_PICKING_PRIORITY;
  activeDetail.name = 'active-hyg-star-detail';
  activeDetail.visible = false;
  activeDetail.userData['objectId'] = null;
  activeDetail.userData['kind'] = 'adaptive-catalog-star';
  activeDetail.add(activeHalo, activeCore);

  return { points, selectionPoint, activeDetail, activeHalo, activeCore, visibleIndices };
}

export function applyStarCatalogQuality(visual: StarCatalogVisual, quality: GraphicQuality): void {
  const profile = OPTICAL_PROFILE_BY_QUALITY[quality];

  visual.points.material.uniforms['diffractionStrength']!.value = profile.diffractionStrength;
  visual.points.material.uniforms['airyStrength']!.value = profile.airyStrength;
  visual.points.material.uniforms['surfaceDetail']!.value = profile.surfaceDetail;
  visual.activeCore.material.uniforms['granulationStrength']!.value = profile.granulationStrength;
  visual.points.userData['quality'] = quality;
}

export function applyActiveCatalogStarAppearance(
  visual: StarCatalogVisual,
  registry: StarCatalogRegistry,
  index: number,
  haloSize: number,
  coreOpacity: number,
): number {
  const colorIndex = registry.catalog.colorIndicesBv[index]!;
  const [red, green, blue] = colorIndexToRgb(colorIndex);
  const profile = getStellarVisualProfile(
    registry.catalog.spectralTypes[index] ?? null,
    colorIndex,
  );
  const color = new THREE.Color(red, green, blue);
  const surfaceSeed = stellarSurfaceSeed(registry.catalog.catalogIds[index]!);

  (visual.activeHalo.material.uniforms['starColor']!.value as THREE.Color).copy(color);
  visual.activeHalo.material.uniforms['coronaStrength']!.value = profile.coronaStrength;
  visual.activeHalo.material.uniforms['cellScale']!.value = profile.cellScale;
  visual.activeHalo.material.uniforms['surfaceContrast']!.value = profile.surfaceContrast;
  visual.activeHalo.material.uniforms['faculaStrength']!.value = profile.faculaStrength;
  visual.activeHalo.material.uniforms['spotStrength']!.value = profile.spotStrength;
  visual.activeHalo.material.uniforms['surfaceSeed']!.value = surfaceSeed;
  visual.activeHalo.material.uniforms['surfaceProfile']!.value = profile.shaderIndex;
  visual.activeHalo.material.uniforms['pointSize']!.value = haloSize * profile.visualScale;
  visual.activeCore.scale.setScalar(CATALOG_STAR_VISUAL_RADIUS * profile.visualScale);
  applyStellarPhotosphereAppearance(visual.activeCore.material, {
    color,
    profile,
    surfaceSeed,
    opacity: coreOpacity,
    granulationStrength: visual.activeCore.material.uniforms['granulationStrength']!
      .value as number,
  });
  visual.activeHalo.userData['visualFamily'] = profile.family;
  visual.activeCore.userData['visualFamily'] = profile.family;

  return profile.visualScale;
}

function createGeometry(registry: StarCatalogRegistry): THREE.BufferGeometry {
  const catalog = registry.catalog;
  const colors = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);
  const intensities = new Float32Array(catalog.count);
  const surfaceProfiles = new Float32Array(catalog.count);
  const surfaceCellScales = new Float32Array(catalog.count);
  const surfaceContrasts = new Float32Array(catalog.count);
  const surfaceCoronae = new Float32Array(catalog.count);
  const surfaceSpotStrengths = new Float32Array(catalog.count);
  const surfaceSeeds = new Float32Array(catalog.count);

  for (let index = 0; index < catalog.count; index += 1) {
    const offset = index * 3;
    const color = colorIndexToRgb(catalog.colorIndicesBv[index]!);
    const brightness = THREE.MathUtils.clamp((7 - catalog.apparentMagnitudes[index]!) / 8.5, 0, 1);
    const perceptualBrightness = Math.pow(brightness, 0.72);
    const profile = getStellarVisualProfile(
      catalog.spectralTypes[index] ?? null,
      catalog.colorIndicesBv[index]!,
    );

    colors[offset] = color[0];
    colors[offset + 1] = color[1];
    colors[offset + 2] = color[2];
    sizes[index] = (1.55 + perceptualBrightness * 6.8) * profile.visualScale;
    alphas[index] = 0.54 + perceptualBrightness * 0.46;
    intensities[index] = THREE.MathUtils.clamp(
      10 ** (-0.4 * (catalog.apparentMagnitudes[index]! + 1.35)),
      0,
      1,
    );
    surfaceProfiles[index] = profile.shaderIndex;
    surfaceCellScales[index] = profile.cellScale;
    surfaceContrasts[index] = profile.surfaceContrast;
    surfaceCoronae[index] = profile.coronaStrength;
    surfaceSpotStrengths[index] = profile.spotStrength;
    surfaceSeeds[index] = stellarSurfaceSeed(catalog.catalogIds[index]!);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(registry.renderPositions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('pointIntensity', new THREE.BufferAttribute(intensities, 1));
  geometry.setAttribute('surfaceProfile', new THREE.BufferAttribute(surfaceProfiles, 1));
  geometry.setAttribute('surfaceCellScale', new THREE.BufferAttribute(surfaceCellScales, 1));
  geometry.setAttribute('surfaceContrast', new THREE.BufferAttribute(surfaceContrasts, 1));
  geometry.setAttribute('surfaceCorona', new THREE.BufferAttribute(surfaceCoronae, 1));
  geometry.setAttribute('surfaceSpotStrength', new THREE.BufferAttribute(surfaceSpotStrengths, 1));
  geometry.setAttribute('surfaceSeed', new THREE.BufferAttribute(surfaceSeeds, 1));
  geometry.setDrawRange(0, catalog.count);
  geometry.computeBoundingSphere();

  return geometry;
}

function createSelectionPoint(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
    },
    vertexShader: `
      uniform float pixelRatio;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 17.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float ring = 1.0 - smoothstep(0.08, 0.2, abs(radius - 0.68));
        float core = (1.0 - smoothstep(0.0, 0.22, radius)) * 0.72;
        float alpha = max(ring * 0.92, core);
        gl_FragColor = vec4(0.48, 0.82, 1.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-hyg-star';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 5;
  point.userData['objectId'] = null;
  point.userData['pickingPriority'] = SELECTED_STAR_PICKING_PRIORITY;

  return point;
}

function createActiveHalo(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      pointSize: { value: 17 },
      starColor: { value: new THREE.Color(0xdce8ff) },
      coronaStrength: { value: 0.86 },
      cellScale: { value: 24 },
      surfaceContrast: { value: 0.24 },
      faculaStrength: { value: 0.46 },
      spotStrength: { value: 0.12 },
      surfaceSeed: { value: 0.5 },
      surfaceProfile: { value: 2 },
    },
    vertexShader: `
      uniform float pixelRatio;
      uniform float pointSize;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform vec3 starColor;
      uniform float coronaStrength;
      uniform float cellScale;
      uniform float surfaceContrast;
      uniform float faculaStrength;
      uniform float spotStrength;
      uniform float surfaceSeed;
      uniform float surfaceProfile;

      ${STELLAR_SPRITE_SURFACE_GLSL}

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float angle = atan(point.y, point.x);
        float angularNoise = stellarSurfaceFbm(
          vec2(cos(angle), sin(angle)) * 3.2 + surfaceSeed * 7.0 + radius * 1.7
        );
        float coronaRays = smoothstep(0.52, 0.66, radius)
          * (1.0 - smoothstep(0.72, 1.0, radius))
          * (0.24 + angularNoise * 0.76)
          * coronaStrength;
        vec4 photosphere = proceduralPhotosphere(
          point * 0.82,
          starColor,
          cellScale,
          surfaceContrast,
          coronaStrength,
          spotStrength,
          surfaceSeed,
          surfaceProfile
        );
        float faculae = smoothstep(
          0.7,
          0.92,
          stellarSurfaceFbm(point * cellScale * 0.34 + surfaceSeed * 9.1)
        ) * faculaStrength;
        vec3 finalColor = photosphere.rgb + starColor * coronaRays * 0.24;
        finalColor = mix(finalColor, vec3(1.0), faculae * photosphere.a * 0.18);
        float alpha = min(1.0, max(photosphere.a, coronaRays * 0.18));
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Points(geometry, material);

  halo.name = 'active-hyg-star-halo';
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  halo.userData['representation'] = 'halo';
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['visualStyle'] = 'procedural-spectral-photosphere-impostor';

  return halo;
}

function createActiveCore(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      starColor: { value: new THREE.Color(0xdce8ff) },
      layerOpacity: { value: 0 },
      granulationStrength: { value: OPTICAL_PROFILE_BY_QUALITY.medium.granulationStrength },
      cellScale: { value: 24 },
      surfaceContrast: { value: 0.24 },
      faculaStrength: { value: 0.46 },
      coronaStrength: { value: 0.86 },
      spotStrength: { value: 0.12 },
      surfaceSeed: { value: 0.5 },
      surfaceProfile: { value: 2 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 starColor;
      uniform float layerOpacity;
      uniform float granulationStrength;
      uniform float cellScale;
      uniform float surfaceContrast;
      uniform float faculaStrength;
      uniform float coronaStrength;
      uniform float spotStrength;
      uniform float surfaceSeed;
      uniform float surfaceProfile;
      varying vec3 vNormal;
      varying vec3 vPosition;

      ${STELLAR_PROFILE_TINT_GLSL}

      float hash31(vec3 point) {
        point = fract(point * 0.1031);
        point += dot(point, point.yzx + 33.33);
        return fract((point.x + point.y) * point.z);
      }

      float noise3(vec3 point) {
        vec3 cell = floor(point);
        vec3 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);

        return mix(
          mix(
            mix(hash31(cell), hash31(cell + vec3(1.0, 0.0, 0.0)), local.x),
            mix(
              hash31(cell + vec3(0.0, 1.0, 0.0)),
              hash31(cell + vec3(1.0, 1.0, 0.0)),
              local.x
            ),
            local.y
          ),
          mix(
            mix(
              hash31(cell + vec3(0.0, 0.0, 1.0)),
              hash31(cell + vec3(1.0, 0.0, 1.0)),
              local.x
            ),
            mix(
              hash31(cell + vec3(0.0, 1.0, 1.0)),
              hash31(cell + vec3(1.0, 1.0, 1.0)),
              local.x
            ),
            local.y
          ),
          local.z
        );
      }

      float fbm(vec3 point) {
        float value = 0.0;
        float amplitude = 0.58;
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise3(point) * amplitude;
          point = point * 2.07 + vec3(5.2, -3.1, 7.4);
          amplitude *= 0.46;
        }
        return value;
      }

      void main() {
        vec3 displayColor = mix(starColor, illustrativeStellarTint(surfaceProfile), 0.28);
        float viewFacing = max(0.0, vNormal.z);
        float limbDarkening = 0.34 + pow(viewFacing, 0.52) * 0.88;
        vec3 surfacePoint = normalize(vPosition);
        vec3 seedOffset = vec3(surfaceSeed * 11.3, surfaceSeed * -7.7, surfaceSeed * 17.9);
        float granulation = fbm(surfacePoint * cellScale + seedOffset);
        float fineGranulation = fbm(
          surfacePoint * cellScale * 2.35 - seedOffset * 0.43 + vec3(4.3, -7.1, 2.8)
        );
        float broadCells = fbm(surfacePoint * max(2.0, cellScale * 0.18) + seedOffset * 0.2);
        float darkCells = smoothstep(0.62, 0.9, broadCells) * spotStrength;
        float cellRidges = pow(1.0 - abs(granulation * 2.0 - 1.0), 4.0);
        float faculae = smoothstep(0.68, 0.9, fineGranulation)
          * pow(max(0.0, 1.0 - viewFacing), 0.45) * faculaStrength;
        float convection = (granulation - 0.5) * surfaceContrast * 2.0
          + cellRidges * granulationStrength * 0.45
          + (fineGranulation - 0.5) * surfaceContrast * 0.34
          - darkCells;
        vec3 photosphere = mix(
          displayColor * 0.34,
          displayColor,
          0.42 + granulation * 0.58
        );
        photosphere = mix(photosphere, vec3(1.0), 0.04 + faculae * 0.28);
        float rimEmission = pow(max(0.0, 1.0 - viewFacing), 2.2) * coronaStrength * 0.13;
        float brightness = clamp(
          limbDarkening * (0.84 + convection + faculae * 0.5) + rimEmission,
          0.18,
          1.24
        );

        gl_FragColor = vec4(photosphere * brightness, layerOpacity);
      }
    `,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);

  core.name = 'active-hyg-star-core';
  core.scale.setScalar(CATALOG_STAR_VISUAL_RADIUS);
  core.visible = false;
  core.renderOrder = 3;
  core.userData['representation'] = 'volume';
  core.userData['scientificConfidence'] = 'illustrative';
  core.userData['visualStyle'] = 'procedural-selected-star-photosphere';

  return core;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      pointScale: { value: 1 },
      radiance: { value: 1 },
      diffractionStrength: { value: 0.5 },
      airyStrength: { value: 0.26 },
      surfaceDetail: { value: 0.72 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float pointIntensity;
      attribute float surfaceProfile;
      attribute float surfaceCellScale;
      attribute float surfaceContrast;
      attribute float surfaceCorona;
      attribute float surfaceSpotStrength;
      attribute float surfaceSeed;
      attribute vec3 color;
      uniform float pixelRatio;
      uniform float pointScale;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vIntensity;
      varying float vSurfaceProfile;
      varying float vSurfaceCellScale;
      varying float vSurfaceContrast;
      varying float vSurfaceCorona;
      varying float vSurfaceSpotStrength;
      varying float vSurfaceSeed;
      varying float vSurfaceReveal;

      void main() {
        vColor = color;
        vAlpha = pointAlpha;
        vIntensity = pointIntensity;
        vSurfaceProfile = surfaceProfile;
        vSurfaceCellScale = surfaceCellScale;
        vSurfaceContrast = surfaceContrast;
        vSurfaceCorona = surfaceCorona;
        vSurfaceSpotStrength = surfaceSpotStrength;
        vSurfaceSeed = surfaceSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float renderedPointSize = max(1.0, pointSize * pointScale * pixelRatio);
        gl_PointSize = renderedPointSize;
        vSurfaceReveal = smoothstep(8.0, 16.0, renderedPointSize);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      uniform float diffractionStrength;
      uniform float airyStrength;
      uniform float surfaceDetail;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vIntensity;
      varying float vSurfaceProfile;
      varying float vSurfaceCellScale;
      varying float vSurfaceContrast;
      varying float vSurfaceCorona;
      varying float vSurfaceSpotStrength;
      varying float vSurfaceSeed;
      varying float vSurfaceReveal;

      ${STELLAR_SPRITE_SURFACE_GLSL}

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float moffatProfile = pow(1.0 + radius * radius * 18.0, -2.15);
        float temperatureHalo = pow(max(0.0, 1.0 - radius), 1.7);
        float airyRing = exp(-pow((radius - 0.36) * 17.0, 2.0)) * airyStrength;
        float luminousCore = 1.0 - smoothstep(0.0, 0.18, radius);
        float horizontal = 1.0 - smoothstep(0.0, 0.055, abs(point.y));
        float vertical = 1.0 - smoothstep(0.0, 0.055, abs(point.x));
        float diagonalA = 1.0 - smoothstep(0.0, 0.042, abs(point.x - point.y));
        float diagonalB = 1.0 - smoothstep(0.0, 0.042, abs(point.x + point.y));
        float brightStar = smoothstep(0.12, 0.82, vIntensity);
        float diffraction = max(horizontal, vertical) * pow(1.0 - radius, 1.8)
          * brightStar * diffractionStrength;
        diffraction += max(diagonalA, diagonalB) * pow(1.0 - radius, 2.4)
          * brightStar * diffractionStrength * airyStrength * 0.46;
        vec3 coreColor = mix(vColor, vec3(1.0), luminousCore * 0.62);
        vec3 opticalColor = coreColor
          * (0.42 + temperatureHalo * 0.7 + moffatProfile * 1.7 + airyRing + diffraction * 1.3)
          * radiance;
        float opticalAlpha = min(
          1.0,
          temperatureHalo * 0.48 + moffatProfile * 0.9 + airyRing + diffraction
        ) * vAlpha * catalogOpacity;
        vec4 photosphere = proceduralPhotosphere(
          point,
          vColor,
          vSurfaceCellScale,
          vSurfaceContrast,
          vSurfaceCorona,
          vSurfaceSpotStrength,
          vSurfaceSeed,
          vSurfaceProfile
        );
        float surfaceReveal = vSurfaceReveal * surfaceDetail;
        vec3 finalColor = mix(opticalColor, photosphere.rgb * radiance, surfaceReveal);
        float alpha = max(
          opticalAlpha * (1.0 - surfaceReveal * 0.34),
          photosphere.a * surfaceReveal * vAlpha * catalogOpacity
        );
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function stellarSurfaceSeed(catalogId: number): number {
  return (Math.imul(catalogId, 2_654_435_761) >>> 0) / 4_294_967_296;
}
