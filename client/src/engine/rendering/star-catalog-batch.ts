import * as THREE from 'three';
import { GraphicQuality, type Vector3Like } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { colorIndexToRgb } from '../materials/star-color';
import { applyStellarPhotosphereAppearance } from '../materials/stellar-photosphere-material';
import {
  STELLAR_PROFILE_TINT_GLSL,
  STELLAR_SPRITE_SURFACE_GLSL,
} from '../materials/stellar-surface-shader';
import { getStellarVisualProfile } from '../materials/stellar-visual-profile';
import { CATALOG_STAR_VISUAL_RADIUS, StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { getHeliocentricCatalogObserverOpacity } from './heliocentric-catalog-visibility';

const LOD_OPACITIES = [0.68, 0.82, 1, 0, 0, 0] as const;
const LOD_POINT_SCALES = [1.9, 1.6, 1.3, 1, 0.82, 0.55] as const;
const ACTIVE_HALO_SIZES = [196, 112, 52, 20, 16, 12] as const;
const ACTIVE_CORE_OPACITIES = [1, 0.28, 0, 0, 0, 0] as const;
const CATALOG_PICKING_PRIORITY = 20;
const SELECTED_STAR_PICKING_PRIORITY = 30;
const OPTICAL_PROFILE_BY_QUALITY: Readonly<
  Record<
    GraphicQuality,
    {
      diffractionStrength: number;
      airyStrength: number;
      granulationStrength: number;
      surfaceDetail: number;
    }
  >
> = {
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
};

export class StarCatalogBatch {
  public readonly root = new THREE.Group();
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly activeDetail: THREE.Group;
  public readonly activeHalo: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly activeCore: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  private readonly totalCount: number;
  private readonly visibleIndices: Uint8Array;
  private drawCount: number;
  private opacity = 0;
  private pointScale = 1;
  private activeHaloSize = 17;
  private activeCoreOpacity = 0;
  private activeVisualScale = 1;
  private readonly observerLocalPosition = new THREE.Vector3();
  private readonly observerWorldInverse = new THREE.Matrix4();

  constructor(
    private readonly registry: StarCatalogRegistry,
    quality: GraphicQuality = 'medium',
  ) {
    const catalog = registry.catalog;
    const geometry = createGeometry(registry);
    const material = createMaterial();

    this.totalCount = catalog.count;
    this.drawCount = catalog.count;
    this.visibleIndices = new Uint8Array(catalog.count);
    this.points = new THREE.Points(geometry, material);
    this.selectionPoint = createSelectionPoint();
    this.activeDetail = new THREE.Group();
    this.activeHalo = createActiveHalo();
    this.activeCore = createActiveCore();
    this.root.name = 'hyg-star-catalog-root';
    this.points.name = 'observed-hyg-star-catalog';
    this.points.layers.enable(PICKING_LAYER);
    this.selectionPoint.layers.enable(PICKING_LAYER);
    this.points.visible = false;
    this.points.renderOrder = 2;
    this.points.userData['catalogCount'] = catalog.count;
    this.points.userData['referenceEpochJulianDay'] = catalog.referenceEpochJulianDay;
    this.points.userData['scientificConfidence'] = 'observed';
    this.points.userData['visualScale'] = 'compressed';
    this.points.userData['objectIds'] = registry.objectIds;
    this.points.userData['visibleIndices'] = this.visibleIndices;
    this.points.userData['appearanceConfidence'] = 'illustrative';
    this.points.userData['visualStyle'] = 'procedural-spectral-photospheres-v3';
    this.points.userData['observerBoundaryOpacity'] = 1;
    this.points.userData['pickingPriority'] = CATALOG_PICKING_PRIORITY;
    this.activeDetail.name = 'active-hyg-star-detail';
    this.activeDetail.visible = false;
    this.activeDetail.userData['objectId'] = null;
    this.activeDetail.userData['kind'] = 'adaptive-catalog-star';
    this.activeDetail.add(this.activeHalo, this.activeCore);
    this.root.add(this.points, this.selectionPoint, this.activeDetail);
    this.setQuality(quality);
  }

  public setDrawLimit(limit: number): void {
    this.drawCount = Math.max(0, Math.min(Math.floor(limit), this.totalCount));
    this.points.geometry.setDrawRange(0, this.drawCount);
    this.updatePickableIndices();
  }

  public setPixelRatio(pixelRatio: number): void {
    const boundedRatio = Math.max(0.5, pixelRatio);

    this.points.material.uniforms['pixelRatio']!.value = boundedRatio;
    this.selectionPoint.material.uniforms['pixelRatio']!.value = boundedRatio;
    this.activeHalo.material.uniforms['pixelRatio']!.value = boundedRatio;
  }

  public setPhotographicRadiance(radiance: number): void {
    this.points.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
  }

  public setQuality(quality: GraphicQuality): void {
    const profile = OPTICAL_PROFILE_BY_QUALITY[quality];

    this.points.material.uniforms['diffractionStrength']!.value = profile.diffractionStrength;
    this.points.material.uniforms['airyStrength']!.value = profile.airyStrength;
    this.points.material.uniforms['surfaceDetail']!.value = profile.surfaceDetail;
    this.activeCore.material.uniforms['granulationStrength']!.value = profile.granulationStrength;
    this.points.userData['quality'] = quality;
  }

  public updateLod(lodLevel: number, deltaSeconds: number, observerPosition?: Vector3Like): void {
    const observerBoundaryOpacity = this.getObserverBoundaryOpacity(observerPosition);
    const targetOpacity =
      (LOD_OPACITIES[lodLevel] ?? LOD_OPACITIES.at(-1)!) * observerBoundaryOpacity;
    const targetPointScale = LOD_POINT_SCALES[lodLevel] ?? LOD_POINT_SCALES.at(-1)!;
    const targetHaloSize = ACTIVE_HALO_SIZES[lodLevel] ?? ACTIVE_HALO_SIZES.at(-1)!;
    const targetCoreOpacity = ACTIVE_CORE_OPACITIES[lodLevel] ?? ACTIVE_CORE_OPACITIES.at(-1)!;
    const wasVisible = this.points.visible;

    this.opacity = dampValue(this.opacity, targetOpacity, 6, deltaSeconds);
    this.pointScale = dampValue(this.pointScale, targetPointScale, 6, deltaSeconds);
    this.activeHaloSize = dampValue(this.activeHaloSize, targetHaloSize, 7, deltaSeconds);
    this.activeCoreOpacity = dampValue(this.activeCoreOpacity, targetCoreOpacity, 7, deltaSeconds);
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.userData['observerBoundaryOpacity'] = observerBoundaryOpacity;
    this.points.material.uniforms['pointScale']!.value = this.pointScale;
    this.activeHalo.material.uniforms['pointSize']!.value =
      this.activeHaloSize * this.activeVisualScale;
    this.activeCore.material.opacity = this.activeCoreOpacity;
    this.activeCore.material.uniforms['layerOpacity']!.value = this.activeCoreOpacity;
    this.activeCore.visible = this.activeDetail.visible && this.activeCoreOpacity > 0.004;
    this.activeHalo.visible = this.activeDetail.visible;
    this.points.visible = this.drawCount > 0 && this.opacity > 0.004;
    if (this.points.visible !== wasVisible) {
      this.updatePickableIndices();
    }
  }

  public select(objectId: string | null): void {
    const index = objectId ? this.registry.getIndex(objectId) : null;

    if (!objectId || index === null) {
      this.selectionPoint.visible = false;
      this.selectionPoint.userData['objectId'] = null;
      this.activeDetail.visible = false;
      this.activeDetail.userData['objectId'] = null;

      return;
    }

    this.selectionPoint.position.fromArray(this.registry.renderPositions, index * 3);
    this.selectionPoint.userData['objectId'] = objectId;
    this.selectionPoint.visible = true;
    this.activeDetail.position.copy(this.selectionPoint.position);
    this.activeDetail.userData['objectId'] = objectId;
    this.activeDetail.visible = true;
    this.activeHalo.visible = true;
    this.activeCore.visible = this.activeCoreOpacity > 0.004;
    this.applyActiveStarColor(index);
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const position = this.registry.getLocalPosition(objectId, target);

    if (!position) {
      return null;
    }
    this.root.updateWorldMatrix(true, false);

    return position.applyMatrix4(this.root.matrixWorld);
  }

  public getPickables(): readonly THREE.Object3D[] {
    return [this.selectionPoint, this.points];
  }

  public get visibleCount(): number {
    return this.points.visible ? this.drawCount : 0;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.selectionPoint.geometry.dispose();
    this.selectionPoint.material.dispose();
    this.activeHalo.geometry.dispose();
    this.activeHalo.material.dispose();
    this.activeCore.geometry.dispose();
    this.activeCore.material.dispose();
    this.activeDetail.clear();
    this.root.clear();
  }

  private applyActiveStarColor(index: number): void {
    const colorIndex = this.registry.catalog.colorIndicesBv[index]!;
    const [red, green, blue] = colorIndexToRgb(colorIndex);
    const profile = getStellarVisualProfile(
      this.registry.catalog.spectralTypes[index] ?? null,
      colorIndex,
    );
    const color = new THREE.Color(red, green, blue);
    const surfaceSeed = stellarSurfaceSeed(this.registry.catalog.catalogIds[index]!);

    (this.activeHalo.material.uniforms['starColor']!.value as THREE.Color).copy(color);
    this.activeHalo.material.uniforms['coronaStrength']!.value = profile.coronaStrength;
    this.activeHalo.material.uniforms['cellScale']!.value = profile.cellScale;
    this.activeHalo.material.uniforms['surfaceContrast']!.value = profile.surfaceContrast;
    this.activeHalo.material.uniforms['faculaStrength']!.value = profile.faculaStrength;
    this.activeHalo.material.uniforms['spotStrength']!.value = profile.spotStrength;
    this.activeHalo.material.uniforms['surfaceSeed']!.value = surfaceSeed;
    this.activeHalo.material.uniforms['surfaceProfile']!.value = profile.shaderIndex;
    this.activeVisualScale = profile.visualScale;
    this.activeHalo.material.uniforms['pointSize']!.value =
      this.activeHaloSize * this.activeVisualScale;
    this.activeCore.scale.setScalar(CATALOG_STAR_VISUAL_RADIUS * profile.visualScale);
    applyStellarPhotosphereAppearance(this.activeCore.material, {
      color,
      profile,
      surfaceSeed,
      opacity: this.activeCoreOpacity,
      granulationStrength: this.activeCore.material.uniforms['granulationStrength']!
        .value as number,
    });
    this.activeHalo.userData['visualFamily'] = profile.family;
    this.activeCore.userData['visualFamily'] = profile.family;
  }

  private updatePickableIndices(): void {
    this.visibleIndices.fill(0);
    if (this.points.visible) {
      this.visibleIndices.fill(1, 0, this.drawCount);
    }
  }

  private getObserverBoundaryOpacity(observerPosition?: Vector3Like): number {
    const sphere = this.points.geometry.boundingSphere;

    if (!observerPosition || !sphere) {
      return 1;
    }
    this.points.updateWorldMatrix(true, false);
    this.observerWorldInverse.copy(this.points.matrixWorld).invert();
    this.observerLocalPosition
      .set(observerPosition.x, observerPosition.y, observerPosition.z)
      .applyMatrix4(this.observerWorldInverse);

    return getHeliocentricCatalogObserverOpacity(
      this.observerLocalPosition.length(),
      sphere.radius + sphere.center.length(),
    );
  }
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
