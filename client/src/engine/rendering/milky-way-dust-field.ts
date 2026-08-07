import * as THREE from 'three';
import { type GraphicQuality, type Vector3Like } from '../../data/models/universe.models';

const GRID_WIDTH = 24;
const GRID_CELL_COUNT = GRID_WIDTH ** 3;
const DETAIL_LEVEL_COUNT = 4;
// The resolved layers carry the traversal. Their density grows with quality while their raster
// footprint stays deliberately small: a passage through the local spur should read as fine dust
// with parallax, never as a new field of enlarged sprites.
// Each quality level keeps the same deterministic cell addresses. This limits simultaneous
// translucent fragments during the crossing without making points shift or appear by direction.
const PARTICLES_PER_CELL = { low: 1, medium: 2, high: 4 } as const;
// At intergalactic viewing distances, four co-spatial grains per static cell are below a pixel
// apart. Retain the same fixed cells and first deterministic samples, but avoid transforming all
// 221k high-quality vertices after the cloud has become a distant traversal context.
const DUST_MEDIUM_SAMPLE_DISTANCE = 12_000;
const DUST_FAR_SAMPLE_DISTANCE = 24_000;
const DENSITY_SIZE = [80, 40, 80] as const;
const HALF_EXTENTS = new THREE.Vector3(7_500, 4_500, 7_500);
const densityTemplates = new WeakMap<object, Uint8Array>();

export function getMilkyWayDustSampleCount(
  quality: GraphicQuality,
  cameraDistance: number,
): number {
  const qualitySamples = PARTICLES_PER_CELL[quality];

  if (!Number.isFinite(cameraDistance) || cameraDistance > DUST_FAR_SAMPLE_DISTANCE) {
    return 1;
  }
  if (cameraDistance > DUST_MEDIUM_SAMPLE_DISTANCE) {
    return Math.min(qualitySamples, 2);
  }

  return qualitySamples;
}

/**
 * Spatially streamed, illustrative dust detail of the point-built galaxy. The observer determines
 * which cells are drawn, never where a grain lives. A cell's integer Galactic address and sample
 * index give it the same grains on entry, exit, rotation, and reverse travel. Cells are replaced
 * beyond the zero-opacity support, not at the camera or at a navigation/LOD boundary.
 *
 * The coarse density is deposited from the actual illustrative Milky Way points, not HYG/Gaia.
 * This is a readable depiction of a cloud, not a measured map of interstellar dust or new stars.
 */
export class MilkyWayDustField {
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly densityTexture: THREE.Data3DTexture;
  private readonly observer = new THREE.Vector3();
  private readonly viewport = new THREE.Vector4();
  private quality: GraphicQuality = 'medium';
  private activeSamples = 0;

  constructor(source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
    this.densityTexture = createDensityTexture(source);
    const material = createMaterial(this.densityTexture);

    this.points = new THREE.Points(createGeometry(), material);
    this.points.name = 'illustrative-milky-way-dust-detail';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.points.userData = {
      scientificConfidence: 'illustrative',
      catalogAssociation: 'none',
      visualRole: 'spatially-resolved-detail-of-the-point-built-galaxy',
      densitySource: 'illustrative-milky-way-point-positions',
      grainInterpretation: 'illustrative-cloud-density-not-measured-dust-or-catalog-stars',
      motionModel: 'fixed-galactic-cell-addresses-with-perspective-parallax',
      streamingTreatment: 'cell-replacement-outside-zero-opacity-support',
      resolutionLevels: 3,
      unresolvedCloudLevel: 'low-opacity-density-splats-not-stellar-halos',
      distanceAdaptiveSampleBudget: 'fixed-prefix-samples-preserving-cell-addresses',
      cellSizes: [16, 64, 256],
      densityResolution: [...DENSITY_SIZE],
      maximumGrainRasterPixels: 3.5,
      maximumUnresolvedCloudRasterPixels: 120,
    };
    this.points.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(this.viewport);
      material.uniforms['viewportHeight']!.value = this.viewport.w;
    };
    this.setQuality('medium');
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    this.applySampleBudget(0);
  }

  public setPixelRatio(pixelRatio: number): void {
    this.points.material.uniforms['pixelRatio']!.value = THREE.MathUtils.clamp(
      pixelRatio,
      0.5,
      1.5,
    );
  }

  public update(
    opacity: number,
    modelScale: number,
    observerPosition?: Vector3Like,
    coarseDetailPresence = 1,
    cameraDistance = 0,
  ): void {
    this.applySampleBudget(cameraDistance);
    this.points.scale.setScalar(modelScale);
    this.points.material.uniforms['opacity']!.value = opacity;
    this.points.material.uniforms['coarseDetailPresence']!.value = THREE.MathUtils.clamp(
      coarseDetailPresence,
      0,
      1,
    );
    this.points.visible = opacity > 0.004 && observerPosition !== undefined;
    if (!observerPosition) {
      return;
    }
    this.observer.set(observerPosition.x, observerPosition.y, observerPosition.z);
    this.points.worldToLocal(this.observer);
    (this.points.material.uniforms['observerLocal']!.value as THREE.Vector3).copy(this.observer);
  }

  public dispose(): void {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.densityTexture.dispose();
  }

  private applySampleBudget(cameraDistance: number): void {
    const samples = getMilkyWayDustSampleCount(this.quality, cameraDistance);

    if (samples === this.activeSamples) {
      return;
    }
    this.activeSamples = samples;
    this.points.geometry.setDrawRange(0, GRID_CELL_COUNT * DETAIL_LEVEL_COUNT * samples);
    this.points.material.uniforms['sampleWeight']!.value = 2 / Math.sqrt(samples);
    this.points.userData['activeSamplesPerCell'] = samples;
  }
}

function createGeometry(): THREE.BufferGeometry {
  const count = GRID_CELL_COUNT * DETAIL_LEVEL_COUNT * PARTICLES_PER_CELL.high;
  const positions = new Float32Array(count * 3);
  const levels = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const cell = Math.floor(index / DETAIL_LEVEL_COUNT) % GRID_CELL_COUNT;

    positions[index * 3] = cell % GRID_WIDTH;
    positions[index * 3 + 1] = Math.floor(cell / GRID_WIDTH) % GRID_WIDTH;
    positions[index * 3 + 2] = Math.floor(cell / GRID_WIDTH ** 2);
    levels[index] = index % DETAIL_LEVEL_COUNT;
    seeds[index] = Math.floor(index / (GRID_CELL_COUNT * DETAIL_LEVEL_COUNT));
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('detailLevel', new THREE.BufferAttribute(levels, 1));
  geometry.setAttribute('sampleSeed', new THREE.BufferAttribute(seeds, 1));

  return geometry;
}

function createDensityTexture(
  source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): THREE.Data3DTexture {
  let data = densityTemplates.get(source.array);

  if (!data) {
    data = depositDensity(source);
    densityTemplates.set(source.array, data);
  }
  const texture = new THREE.Data3DTexture(data, ...DENSITY_SIZE);

  texture.name = 'milky-way-point-density-for-dust-detail';
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}

function depositDensity(
  source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): Uint8Array {
  const [width, height, depth] = DENSITY_SIZE;
  const histogram = new Float32Array(width * height * depth);
  const data = new Uint8Array(histogram.length);

  for (let index = 0; index < source.count; index += 1) {
    const x = THREE.MathUtils.clamp(
      Math.floor(((source.getX(index) / HALF_EXTENTS.x) * 0.5 + 0.5) * width),
      1,
      width - 2,
    );
    const y = THREE.MathUtils.clamp(
      Math.floor(((source.getY(index) / HALF_EXTENTS.y) * 0.5 + 0.5) * height),
      1,
      height - 2,
    );
    const z = THREE.MathUtils.clamp(
      Math.floor(((source.getZ(index) / HALF_EXTENTS.z) * 0.5 + 0.5) * depth),
      1,
      depth - 2,
    );
    const offset = x + width * (y + height * z);

    histogram[offset]! += 0.4;
    for (const neighbour of [-1, 1, -width, width, -width * height, width * height]) {
      histogram[offset + neighbour]! += 0.1;
    }
  }
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.round(255 * (1 - Math.exp(-histogram[index]! * 0.24)));
  }

  return data;
}

function createMaterial(densityTexture: THREE.Data3DTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      densityTexture: { value: densityTexture },
      densityHalfExtents: { value: HALF_EXTENTS.clone() },
      observerLocal: { value: new THREE.Vector3() },
      opacity: { value: 0 },
      coarseDetailPresence: { value: 1 },
      sampleWeight: { value: 1 },
      pixelRatio: { value: 1 },
      viewportHeight: { value: 900 },
    },
    vertexShader: `
      precision highp sampler3D;
      uniform sampler3D densityTexture;
      uniform vec3 densityHalfExtents;
      uniform vec3 observerLocal;
      uniform float coarseDetailPresence;
      uniform float sampleWeight;
      uniform float pixelRatio;
      uniform float viewportHeight;
      in float detailLevel;
      in float sampleSeed;
      out vec3 dustColor;
      out float dustAlpha;
      out float unresolvedCloud;

      vec3 hashCell(vec3 cell) {
        vec3 p = fract(cell * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.xxy + p.yxx) * p.zyx);
      }

      float cloudNoise(vec3 p) {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hashCell(cell).x, hashCell(cell + vec3(1, 0, 0)).x, f.x),
              mix(hashCell(cell + vec3(0, 1, 0)).x, hashCell(cell + vec3(1, 1, 0)).x, f.x), f.y),
          mix(mix(hashCell(cell + vec3(0, 0, 1)).x, hashCell(cell + vec3(1, 0, 1)).x, f.x),
              mix(hashCell(cell + vec3(0, 1, 1)).x, hashCell(cell + vec3(1, 1, 1)).x, f.x), f.y), f.z
        );
      }

      void main() {
        unresolvedCloud = step(2.5, detailLevel);
        float cellSize = unresolvedCloud > 0.5 ? 128.0 : 16.0 * pow(4.0, detailLevel);
        vec3 cell = position + floor(observerLocal / cellSize) - vec3(12.0);
        vec3 seed = hashCell(cell + vec3(sampleSeed * 71.0 + detailLevel * 137.0));
        vec3 galacticPosition = (cell + seed) * cellSize;
        vec3 relativePosition = galacticPosition - observerLocal;
        float distanceInCells = length(relativePosition) / cellSize;
        // The 24-cell cube encloses this 10-cell support even after a one-cell streaming step.
        // Thus newly inserted / removed cells are already invisible in every viewing direction.
        float support = 1.0 - smoothstep(8.0, 10.0, distanceInCells);
        float innerSupport = detailLevel < 0.5 || unresolvedCloud > 0.5
          ? smoothstep(0.06, 0.28, distanceInCells)
          : smoothstep(1.5, 2.5, distanceInCells);
        vec3 uvw = galacticPosition / (2.0 * densityHalfExtents) + 0.5;
        float boundary = 1.0 - smoothstep(0.92, 1.0,
          max(max(abs(uvw.x * 2.0 - 1.0), abs(uvw.y * 2.0 - 1.0)), abs(uvw.z * 2.0 - 1.0)));
        float density = texture(densityTexture, uvw).r * boundary;
        // Shared world-space filaments, not a different random fog at each detail level.
        vec3 p = galacticPosition / vec3(190.0, 105.0, 190.0);
        float broad = cloudNoise(p);
        float fine = cloudNoise(p * 3.1 + vec3(17.2, 5.8, 11.6));
        float filaments = smoothstep(0.28, 0.72, broad * 0.7 + fine * 0.3);
        float cloud = density * (0.1 + filaments * 1.9);
        vec4 viewPosition = modelViewMatrix * vec4(galacticPosition, 1.0);
        float worldScale = length(modelMatrix[0].xyz);
        float focalPixels = 0.5 * viewportHeight * projectionMatrix[1][1];
        float projectedDiameter = cellSize * (0.009 + seed.y * 0.018)
          * worldScale * focalPixels / max(-viewPosition.z, 0.001);
        // Let the added samples create depth through parallax and density rather than through
        // large raster discs. The fixed grains remain part of the same streamed Galactic cells.
        float rasterDiameter = 3.5 * pixelRatio;
        float coverage = min(1.0, pow(projectedDiameter / rasterDiameter, 2.0));

        dustColor = mix(vec3(0.69, 0.72, 0.86), vec3(0.91, 0.83, 0.71), broad);
        dustAlpha = min(0.85, cloud * (0.62 + seed.z * 0.72) * sampleWeight)
          * coverage * support * innerSupport;
        if (unresolvedCloud > 0.5) {
          // Sparse overlapping density elements supply the space between the resolved grains.
          // They cannot become a screen-sized, galaxy-shaped decal during the traversal.
          float projectedCloud = cellSize * 2.8 * worldScale * focalPixels
            / max(-viewPosition.z, 0.001);
          rasterDiameter = min(120.0 * pixelRatio, projectedCloud);
          dustAlpha = 0.0055 * cloud * support * innerSupport * (1.0 - step(0.5, sampleSeed));
          dustColor = mix(vec3(0.29, 0.28, 0.40), vec3(0.48, 0.43, 0.37), broad);
        }
        // The two coarsest cell sizes describe the distant morphology. As the observer enters
        // the cloud they yield to the unchanged finer cells, preventing an arm-shaped decal from
        // surviving in the local view.
        float coarseLayer = smoothstep(1.5, 2.5, detailLevel);
        dustAlpha *= mix(1.0, coarseDetailPresence, coarseLayer);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = dustAlpha > 0.00001 ? max(1.0, rasterDiameter) : 1.0;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      in vec3 dustColor;
      in float dustAlpha;
      in float unresolvedCloud;
      out vec4 fragmentColor;
      #define gl_FragColor fragmentColor

      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) { discard; }
        float grain = exp(-r2 * mix(8.0, 4.0, unresolvedCloud))
          * (1.0 - smoothstep(0.64, 1.0, r2));
        gl_FragColor = vec4(dustColor, grain * dustAlpha * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}
