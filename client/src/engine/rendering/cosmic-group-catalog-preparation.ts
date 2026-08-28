import { type BufferGeometry } from 'three';
import { type CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { prepareCatalogIncrementally } from '../core/catalog-preparation';
import {
  prepareCosmicGroupFilamentGeometry,
  prepareCosmicGroupPointGeometry,
} from './cosmic-group-catalog-geometry';
import { type CosmicGroupCatalogGeometries } from './cosmic-group-catalog-visual';
import { prepareLocalVolumeDepthGeometry } from './local-volume-depth-backdrop';

export interface PreparedCosmicGroupCatalog {
  readonly groups: CosmicGroupCatalogGeometries;
  readonly backdrop: BufferGeometry;
}

export async function prepareCosmicGroupCatalog(
  registry: CosmicGroupCatalogRegistry,
  yieldControl: () => Promise<void>,
): Promise<PreparedCosmicGroupCatalog> {
  const completed: BufferGeometry[] = [];

  try {
    const filaments = await prepareCatalogIncrementally(
      prepareCosmicGroupFilamentGeometry(registry, registry.catalog.filamentPairs),
      yieldControl,
    );

    completed.push(filaments.geometry);
    const points = await prepareCatalogIncrementally(
      prepareCosmicGroupPointGeometry(registry),
      yieldControl,
    );

    completed.push(points.geometry);
    const backdrop = await prepareCatalogIncrementally(
      prepareLocalVolumeDepthGeometry(registry),
      yieldControl,
    );

    // Ownership transfers together; no partially prepared catalogue enters the live scene.
    return { groups: { filaments, points }, backdrop };
  } catch (error) {
    for (const geometry of completed) {
      geometry.dispose();
    }
    throw error;
  }
}

export function disposePreparedCosmicGroupCatalog(prepared: PreparedCosmicGroupCatalog): void {
  prepared.groups.filaments.geometry.dispose();
  prepared.groups.points.geometry.dispose();
  prepared.backdrop.dispose();
}
