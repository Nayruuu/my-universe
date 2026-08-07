import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  createCelestialVisual,
  createCelestialVisualAssets,
} from '../materials/celestial-visual-factory';
import { FarObjectBatch } from '../rendering/far-object-batch';
import { PositionProviderFactory } from '../simulation/position-providers';
import { createObjectRegistryAssemblyPlan } from './object-registry-assembly';
import type { ObjectRegistryEntry } from './object-registry-entry';

export interface BuiltObjectRegistry {
  readonly entries: Map<string, ObjectRegistryEntry>;
  readonly pickables: THREE.Object3D[];
  readonly registryRoot: THREE.Group;
  readonly farObjectBatch: FarObjectBatch;
  readonly batchedGalaxyTotal: number;
}

export function buildObjectRegistry(
  spaceRoot: THREE.Group,
  coordinateSystem: CoordinateSystem,
  objects: readonly SpaceObject[],
  quality: GraphicQuality,
): BuiltObjectRegistry {
  const plan = createObjectRegistryAssemblyPlan(objects);
  const providerFactory = new PositionProviderFactory(coordinateSystem);
  const visualAssets = createCelestialVisualAssets(quality);
  const entries = new Map<string, ObjectRegistryEntry>();
  const pickables: THREE.Object3D[] = [];
  const registryRoot = new THREE.Group();
  const farObjectBatch = new FarObjectBatch(plan.farObjects, quality);

  registryRoot.name = 'astronomical-object-registry';
  spaceRoot.add(registryRoot);
  registryRoot.add(farObjectBatch.points);
  pickables.push(farObjectBatch.points);

  for (const definition of plan.renderableObjects) {
    const node = new THREE.Group();
    const visual = createCelestialVisual(definition, quality, visualAssets);

    node.name = definition.id;
    node.add(visual.root);
    entries.set(definition.id, {
      definition,
      node,
      visualRoot: visual.root,
      lensingForeground: visual.lensingForeground,
      rotatingBody: visual.rotatingBody,
      lunarEclipse: visual.lunarEclipse,
      solarEclipse: visual.solarEclipse,
      supernova: visual.supernova,
      cometActivity: visual.cometActivity ?? null,
      observerCorona: visual.observerCorona,
      lod: visual.lod,
      farBatchIndex: plan.farIndexById.get(definition.id) ?? null,
      pickTarget: visual.pickables[0] ?? null,
      provider: providerFactory.create(definition.positionProvider, definition.referenceFrame),
    });
    pickables.push(...visual.pickables);
  }

  for (const [objectId, entry] of entries) {
    const parentId = plan.renderParentById.get(objectId);
    const parent = parentId ? entries.get(parentId)?.node : undefined;

    (parent ?? registryRoot).add(entry.node);
  }

  return {
    entries,
    pickables,
    registryRoot,
    farObjectBatch,
    batchedGalaxyTotal: plan.batchedGalaxyTotal,
  };
}
