import * as THREE from 'three';
import { colorIndexToRgb } from '../materials/star-color';
import { getStellarVisualProfile } from '../materials/stellar-visual-profile';
import type { StarCatalogRegistry } from '../objects/star-catalog-registry';

export function createStarCatalogGeometry(registry: StarCatalogRegistry): THREE.BufferGeometry {
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
    surfaceSeeds[index] = stellarCatalogSurfaceSeed(catalog.catalogIds[index]!);
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

export function stellarCatalogSurfaceSeed(catalogId: number): number {
  return (Math.imul(catalogId, 2_654_435_761) >>> 0) / 4_294_967_296;
}
