import * as THREE from 'three';
import { STELLAR_SPRITE_SURFACE_GLSL } from '../materials/stellar-surface-shader';
import {
  getStellarVisualProfile,
  getStellarVisualProfileFromTemperature,
} from '../materials/stellar-visual-profile';
import { ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';

const CATALOG_PICKING_PRIORITY = 18;
const SELECTED_HOST_PICKING_PRIORITY = 31;

export interface ExoplanetHostVisual {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly renderedHostIndices: readonly number[];
  readonly visibleIndices: Uint8Array;
}

export function createExoplanetHostVisual(registry: ExoplanetCatalogRegistry): ExoplanetHostVisual {
  const renderedHostIndices = registry.getRenderableHostIndices();
  const visibleIndices = new Uint8Array(renderedHostIndices.length);
  const geometry = createGeometry(registry, renderedHostIndices);
  const points = new THREE.Points(geometry, createMaterial());
  const selectionPoint = createSelectionPoint();

  points.name = 'observed-nasa-exoplanet-hosts';
  points.visible = false;
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.layers.enable(PICKING_LAYER);
  selectionPoint.layers.enable(PICKING_LAYER);
  points.userData['catalogCount'] = registry.catalog.hostCount;
  points.userData['renderedHostCount'] = renderedHostIndices.length;
  points.userData['planetCount'] = registry.catalog.planetCount;
  points.userData['scientificConfidence'] = 'observed';
  points.userData['appearanceConfidence'] = 'illustrative';
  points.userData['source'] = 'NASA Exoplanet Archive · PSCompPars';
  points.userData['visualStyle'] = 'procedural-stellar-photosphere-with-exoplanet-ring';
  points.userData['hostSignatureTreatment'] = 'suppressed-at-planetary-scale';
  points.userData['observerBoundaryOpacity'] = 1;
  points.userData['objectIds'] = renderedHostIndices.map(
    (hostIndex) => registry.hostObjectIds[hostIndex]!,
  );
  points.userData['visibleIndices'] = visibleIndices;
  points.userData['pickingPriority'] = CATALOG_PICKING_PRIORITY;

  return { points, selectionPoint, renderedHostIndices, visibleIndices };
}

function createGeometry(
  registry: ExoplanetCatalogRegistry,
  hostIndices: readonly number[],
): THREE.BufferGeometry {
  const catalog = registry.catalog;
  const positions = new Float32Array(hostIndices.length * 3);
  const colors = new Float32Array(hostIndices.length * 3);
  const sizes = new Float32Array(hostIndices.length);
  const alphas = new Float32Array(hostIndices.length);
  const surfaceProfiles = new Float32Array(hostIndices.length);
  const surfaceCellScales = new Float32Array(hostIndices.length);
  const surfaceContrasts = new Float32Array(hostIndices.length);
  const surfaceCoronae = new Float32Array(hostIndices.length);
  const surfaceSpotStrengths = new Float32Array(hostIndices.length);
  const surfaceSeeds = new Float32Array(hostIndices.length);

  for (let renderIndex = 0; renderIndex < hostIndices.length; renderIndex += 1) {
    const hostIndex = hostIndices[renderIndex]!;
    const sourceOffset = hostIndex * 3;
    const renderOffset = renderIndex * 3;
    const color = stellarTemperatureRgb(catalog.hostTemperaturesKelvin[hostIndex]!);
    const apparentMagnitude = catalog.hostApparentMagnitudes[hostIndex]!;
    const brightness = Number.isFinite(apparentMagnitude)
      ? THREE.MathUtils.clamp((16 - apparentMagnitude) / 18, 0, 1)
      : 0.28;
    const planetProminence = THREE.MathUtils.clamp(catalog.hostPlanetCounts[hostIndex]! / 7, 0, 1);
    const spectralType = catalog.hostSpectralTypes[hostIndex] ?? null;
    const profile = spectralType
      ? getStellarVisualProfile(spectralType, Number.NaN)
      : getStellarVisualProfileFromTemperature(catalog.hostTemperaturesKelvin[hostIndex]!);

    positions[renderOffset] = registry.renderPositions[sourceOffset]!;
    positions[renderOffset + 1] = registry.renderPositions[sourceOffset + 1]!;
    positions[renderOffset + 2] = registry.renderPositions[sourceOffset + 2]!;
    colors[renderOffset] = color[0];
    colors[renderOffset + 1] = color[1];
    colors[renderOffset + 2] = color[2];
    sizes[renderIndex] =
      (5.2 + Math.pow(brightness, 0.7) * 4.2 + planetProminence * 1.2) * profile.visualScale;
    alphas[renderIndex] = 0.52 + brightness * 0.3 + planetProminence * 0.18;
    surfaceProfiles[renderIndex] = profile.shaderIndex;
    surfaceCellScales[renderIndex] = profile.cellScale;
    surfaceContrasts[renderIndex] = profile.surfaceContrast;
    surfaceCoronae[renderIndex] = profile.coronaStrength;
    surfaceSpotStrengths[renderIndex] = profile.spotStrength;
    surfaceSeeds[renderIndex] = stellarSurfaceSeed(hostIndex + 1);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('surfaceProfile', new THREE.BufferAttribute(surfaceProfiles, 1));
  geometry.setAttribute('surfaceCellScale', new THREE.BufferAttribute(surfaceCellScales, 1));
  geometry.setAttribute('surfaceContrast', new THREE.BufferAttribute(surfaceContrasts, 1));
  geometry.setAttribute('surfaceCorona', new THREE.BufferAttribute(surfaceCoronae, 1));
  geometry.setAttribute('surfaceSpotStrength', new THREE.BufferAttribute(surfaceSpotStrengths, 1));
  geometry.setAttribute('surfaceSeed', new THREE.BufferAttribute(surfaceSeeds, 1));
  geometry.setDrawRange(0, hostIndices.length);
  geometry.computeBoundingSphere();

  return geometry;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      pointScale: { value: 1 },
      radiance: { value: 1 },
      surfaceDetail: { value: 1 },
      hostSignatureStrength: { value: 0 },
    },
    vertexShader: `
      attribute vec3 starColor;
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float surfaceProfile;
      attribute float surfaceCellScale;
      attribute float surfaceContrast;
      attribute float surfaceCorona;
      attribute float surfaceSpotStrength;
      attribute float surfaceSeed;
      uniform float pixelRatio;
      uniform float pointScale;
      varying vec3 vStarColor;
      varying float vAlpha;
      varying float vSurfaceProfile;
      varying float vSurfaceCellScale;
      varying float vSurfaceContrast;
      varying float vSurfaceCorona;
      varying float vSurfaceSpotStrength;
      varying float vSurfaceSeed;
      varying float vSurfaceReveal;

      void main() {
        vStarColor = starColor;
        vAlpha = pointAlpha;
        vSurfaceProfile = surfaceProfile;
        vSurfaceCellScale = surfaceCellScale;
        vSurfaceContrast = surfaceContrast;
        vSurfaceCorona = surfaceCorona;
        vSurfaceSpotStrength = surfaceSpotStrength;
        vSurfaceSeed = surfaceSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float renderedPointSize = max(1.0, pointSize * pointScale * pixelRatio);
        gl_PointSize = renderedPointSize;
        vSurfaceReveal = smoothstep(12.0, 22.0, renderedPointSize);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      uniform float surfaceDetail;
      uniform float hostSignatureStrength;
      varying vec3 vStarColor;
      varying float vAlpha;
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
        vec4 photosphere = proceduralPhotosphere(
          point,
          vStarColor,
          vSurfaceCellScale,
          vSurfaceContrast,
          vSurfaceCorona,
          vSurfaceSpotStrength,
          vSurfaceSeed,
          vSurfaceProfile
        );
        float stellarGlow = exp(-radius * 4.4);
        float stellarCore = 1.0 - smoothstep(0.0, 0.18, radius);
        float exoplanetRing = 1.0 - smoothstep(0.045, 0.12, abs(radius - 0.7));
        float hostSignature = exoplanetRing * hostSignatureStrength;
        vec3 ringColor = vec3(0.34, 0.78, 1.0);
        float surfaceReveal = vSurfaceReveal * surfaceDetail;
        vec3 opticalColor = vStarColor * (stellarGlow + stellarCore * 1.65);
        vec3 finalColor = (
          mix(opticalColor, photosphere.rgb, surfaceReveal)
          + ringColor * hostSignature * 0.46
        ) * radiance;
        float opticalAlpha = min(1.0, stellarGlow * 0.65 + stellarCore);
        float alpha = min(
          1.0,
          max(opticalAlpha, photosphere.a * surfaceReveal) + hostSignature * 0.34
        ) * vAlpha * catalogOpacity;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function stellarSurfaceSeed(identifier: number): number {
  return (Math.imul(identifier, 2_654_435_761) >>> 0) / 4_294_967_296;
}

function createSelectionPoint(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `
      uniform float pixelRatio;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 20.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float outerRing = 1.0 - smoothstep(0.055, 0.15, abs(radius - 0.74));
        float innerCore = (1.0 - smoothstep(0.0, 0.2, radius)) * 0.76;
        gl_FragColor = vec4(0.42, 0.86, 1.0, max(outerRing, innerCore));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-exoplanet-system';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 6;
  point.userData['objectId'] = null;
  point.userData['pickingPriority'] = SELECTED_HOST_PICKING_PRIORITY;

  return point;
}

function stellarTemperatureRgb(temperatureKelvin: number): readonly [number, number, number] {
  const color = new THREE.Color(
    temperatureKelvin >= 10_000
      ? '#9bbcff'
      : temperatureKelvin >= 7_500
        ? '#cad8ff'
        : temperatureKelvin >= 6_000
          ? '#fff4e8'
          : temperatureKelvin >= 5_000
            ? '#ffe6bd'
            : temperatureKelvin >= 3_500
              ? '#ffba82'
              : '#ff7955',
  );

  return [color.r, color.g, color.b];
}
