import {
  type DisplayOptions,
  type SpaceObject,
  type UniverseTime,
} from '../../data/models/universe.models';
import { type ObjectRegistry } from '../objects/object-registry';

export interface DynamicRegistryObjectRuntime {
  replaceExoplanetSystem(registry: ObjectRegistry | null): void;
  replaceStreamed(registry: ObjectRegistry | null): void;
}

export interface UniverseDynamicRegistryBindings {
  createRegistry(objects: readonly SpaceObject[]): ObjectRegistry | null;
  getCurrentTime(): UniverseTime;
  getDisplayOptions(): DisplayOptions;
  getTargetId(): string | null;
  getSelectedId(): string | null;
}

export class UniverseDynamicRegistryCoordinator {
  constructor(
    private readonly objectRuntime: DynamicRegistryObjectRuntime,
    private readonly bindings: UniverseDynamicRegistryBindings,
  ) {}

  public rebuildExoplanetSystem(objects: readonly SpaceObject[]): void {
    this.objectRuntime.replaceExoplanetSystem(null);
    const registry = this.createConfiguredRegistry(objects, true);

    if (registry) {
      this.objectRuntime.replaceExoplanetSystem(registry);
    }
  }

  public rebuildStreamedObjects(objects: readonly SpaceObject[]): void {
    this.objectRuntime.replaceStreamed(null);
    const registry = this.createConfiguredRegistry(objects, false);

    if (registry) {
      this.objectRuntime.replaceStreamed(registry);
    }
  }

  private createConfiguredRegistry(
    objects: readonly SpaceObject[],
    updateBodyRotations: boolean,
  ): ObjectRegistry | null {
    if (objects.length === 0) {
      return null;
    }
    const registry = this.bindings.createRegistry(objects);

    if (!registry) {
      return null;
    }
    const currentTime = this.bindings.getCurrentTime();

    registry.setDisplayOptions(this.bindings.getDisplayOptions());
    registry.updatePositions(currentTime);
    if (updateBodyRotations) {
      registry.updateBodyRotations(currentTime);
    }
    registry.setNavigationTarget(this.resolveKnownObjectId(registry, this.bindings.getTargetId()));
    registry.select(this.resolveKnownObjectId(registry, this.bindings.getSelectedId()));

    return registry;
  }

  private resolveKnownObjectId(registry: ObjectRegistry, objectId: string | null): string | null {
    if (!objectId) {
      return null;
    }

    return registry.has(objectId) ? objectId : null;
  }
}
