import * as THREE from 'three';
import { NearbyGalaxyOverviewEntry } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  getNearbyGalaxyOverviewTargetOpacity,
  NearbyGalaxyOverviewBatch,
} from './nearby-galaxy-overview-batch';

describe('NearbyGalaxyOverviewBatch', () => {
  it('regroupe toutes les positions observées dans un seul batch GPU', () => {
    const batch = new NearbyGalaxyOverviewBatch(entries(), new CoordinateSystem());
    const geometry = batch.points.geometry;

    expect(batch.points).toBeInstanceOf(THREE.Points);
    expect(batch.points.name).toBe('observed-nearby-galaxy-overview');
    expect(batch.points.userData).toMatchObject({
      catalogCount: 2,
      scientificConfidence: 'observed',
      appearanceConfidence: 'illustrative',
      visualStyle: 'structured-local-volume-galaxy-impostors',
      sceneRole: 'observed-line-of-sight-background',
    });
    expect(geometry.getAttribute('position').count).toBe(2);
    expect(geometry.getAttribute('pointSize').count).toBe(2);
    expect(geometry.getAttribute('pointAlpha').count).toBe(2);
    expect(geometry.getAttribute('color').count).toBe(2);
    expect(geometry.getAttribute('galaxyAngle').count).toBe(2);
    expect(geometry.getAttribute('galaxyAxisRatio').count).toBe(2);
    expect(geometry.getAttribute('galaxyProfile').count).toBe(2);
    expect(geometry.getAttribute('galaxyProminence').count).toBe(2);
    expect(geometry.getAttribute('galaxySeed').count).toBe(2);
    expect(batch.points.material.fragmentShader).toContain('float spiralArms');
    expect(batch.points.material.fragmentShader).toContain('float dustLane');
    expect(batch.points.material.fragmentShader).toContain('float stellarKnots');
    expect(batch.points.material.fragmentShader).toContain('halo < 0.015');
    expect(batch.points.material.fragmentShader).toContain('radius > 1.0');
    expect(batch.points.material.vertexShader).toContain('float prominenceScale');
    expect(Array.from(geometry.getAttribute('position').array)).toEqual([
      4_000, 8_000, -4_000, -8_000, 2_000, 12_000,
    ]);
    expect(batch.visibleCount).toBe(0);

    const sizes = geometry.getAttribute('pointSize') as THREE.BufferAttribute;
    const angles = geometry.getAttribute('galaxyAngle') as THREE.BufferAttribute;
    const axisRatios = geometry.getAttribute('galaxyAxisRatio') as THREE.BufferAttribute;
    const profiles = geometry.getAttribute('galaxyProfile') as THREE.BufferAttribute;

    expect(sizes.getX(0)).toBeGreaterThan(5);
    expect(sizes.getX(0)).toBeLessThan(9);
    expect(sizes.getX(1)).toBeGreaterThan(sizes.getX(0));
    for (let index = 0; index < 2; index += 1) {
      expect(angles.getX(index)).toBeGreaterThanOrEqual(0);
      expect(angles.getX(index)).toBeLessThan(Math.PI * 2);
      expect(axisRatios.getX(index)).toBeGreaterThanOrEqual(0.22);
      expect(axisRatios.getX(index)).toBeLessThanOrEqual(0.96);
      expect(profiles.getX(index)).toBeGreaterThanOrEqual(0);
      expect(profiles.getX(index)).toBeLessThan(1);
    }
    expect(batch.points.material.blending).toBe(THREE.NormalBlending);

    batch.setPixelRatio(0.1);
    expect(batch.points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    batch.setPixelRatio(1.75);
    expect(batch.points.material.uniforms['pixelRatio']!.value).toBe(1.75);
    batch.setPhotographicRadiance(0);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(1.5);

    const disposeGeometry = vi.spyOn(batch.points.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(batch.points.material, 'dispose');

    batch.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('effectue un fondu continu entre Groupe local, Univers proche et réseau cosmique', () => {
    expect(getNearbyGalaxyOverviewTargetOpacity(6_200)).toBe(0);
    expect(getNearbyGalaxyOverviewTargetOpacity(9_600)).toBeGreaterThan(0.11);
    expect(getNearbyGalaxyOverviewTargetOpacity(13_300)).toBeGreaterThan(0.36);
    expect(getNearbyGalaxyOverviewTargetOpacity(17_000)).toBeGreaterThan(0.54);
    expect(getNearbyGalaxyOverviewTargetOpacity(18_000)).toBeCloseTo(0.56, 5);
    expect(getNearbyGalaxyOverviewTargetOpacity(26_000)).toBeGreaterThan(0.52);
    expect(getNearbyGalaxyOverviewTargetOpacity(45_000)).toBeGreaterThan(0);
    expect(getNearbyGalaxyOverviewTargetOpacity(120_000)).toBeCloseTo(0.42, 5);
    expect(getNearbyGalaxyOverviewTargetOpacity(220_000)).toBeGreaterThan(0);
    expect(getNearbyGalaxyOverviewTargetOpacity(300_000)).toBe(0);

    const before = getNearbyGalaxyOverviewTargetOpacity(149_999);
    const after = getNearbyGalaxyOverviewTargetOpacity(150_001);

    expect(Math.abs(after - before)).toBeLessThan(0.000_01);
  });

  it('ne crée aucune géométrie fantôme sans aperçu statique', () => {
    const batch = new NearbyGalaxyOverviewBatch([], new CoordinateSystem());

    batch.updateDistance(120_000, 10);
    expect(batch.points.visible).toBe(false);
    expect(batch.visibleCount).toBe(0);
    batch.dispose();
  });

  it('amortit la visibilité sans saut pendant la navigation', () => {
    const batch = new NearbyGalaxyOverviewBatch(entries(), new CoordinateSystem());

    batch.updateDistance(6_200, 10);
    expect(batch.points.visible).toBe(false);

    batch.updateDistance(120_000, 1 / 60);
    const transitionOpacity = batch.points.material.uniforms['catalogOpacity']!.value as number;

    expect(transitionOpacity).toBeGreaterThan(0);
    expect(transitionOpacity).toBeLessThan(0.42);
    expect(batch.points.visible).toBe(true);
    expect(batch.visibleCount).toBe(2);

    batch.updateDistance(120_000, 10);
    expect(batch.points.material.uniforms['catalogOpacity']!.value).toBeCloseTo(0.42, 5);
    batch.updateDistance(300_000, 10);
    expect(batch.points.visible).toBe(false);
    expect(batch.visibleCount).toBe(0);
    batch.dispose();
  });
});

function entries(): NearbyGalaxyOverviewEntry[] {
  return [
    {
      id: 'galaxy-a',
      position: [1, 2, -1],
      unit: 'megaparsec',
      color: '#9fc8ef',
      visualRadius: 12,
    },
    {
      id: 'galaxy-b',
      position: [-2, 0.5, 3],
      unit: 'megaparsec',
      color: '#e4bb91',
      visualRadius: 120,
    },
  ];
}
