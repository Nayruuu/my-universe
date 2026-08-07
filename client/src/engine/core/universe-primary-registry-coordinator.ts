import { type DisplayOptions, type UniverseTime } from '../../data/models/universe.models';
import { type ObjectRegistry } from '../objects/object-registry';
import { type SolarEclipseAppearance } from '../simulation/earth-eclipse';

export interface PrimaryRegistryObjectRuntime {
  replacePrimary(registry: ObjectRegistry | null): void;
  replaceStreamed(registry: ObjectRegistry | null): void;
}

export interface UniversePrimaryRegistryBindings {
  createRegistry(): ObjectRegistry | null;
  getCurrentTime(): UniverseTime;
  getDisplayOptions(): DisplayOptions;
  getTargetId(): string | null;
  getSelectedId(): string | null;
  isCatalogObject(objectId: string): boolean;
  hasConstellation(objectId: string): boolean;
  selectCatalogObject(objectId: string | null): void;
  selectConstellation(objectId: string | null): void;
  resetRotationPlayback(time: UniverseTime): void;
  emitSolarEclipseState(appearance: SolarEclipseAppearance): void;
  restoreSolarEclipsePresentation(registry: ObjectRegistry): void;
  rebuildDynamicRegistries(): void;
  followCurrentTarget(): void;
}

export class UniversePrimaryRegistryCoordinator {
  constructor(
    private readonly objectRuntime: PrimaryRegistryObjectRuntime,
    private readonly bindings: UniversePrimaryRegistryBindings,
  ) {}

  public rebuild(): void {
    const registry = this.bindings.createRegistry();

    if (!registry) {
      return;
    }
    this.objectRuntime.replacePrimary(null);
    this.objectRuntime.replaceStreamed(null);
    const currentTime = this.bindings.getCurrentTime();
    const solarEclipseAppearance = registry.updatePositions(currentTime);

    registry.updateBodyRotations(currentTime);
    this.bindings.resetRotationPlayback(currentTime);
    this.bindings.emitSolarEclipseState(solarEclipseAppearance);
    registry.setDisplayOptions(this.bindings.getDisplayOptions());

    const targetId = this.resolveKnownObjectId(registry, this.bindings.getTargetId());
    const selectedId = this.bindings.getSelectedId();
    const selectedRegistryId = this.resolveKnownObjectId(registry, selectedId);
    const selectedCatalogId =
      selectedId && !selectedRegistryId && this.bindings.isCatalogObject(selectedId)
        ? selectedId
        : null;
    const selectedConstellationId =
      selectedId && this.bindings.hasConstellation(selectedId) ? selectedId : null;

    registry.setNavigationTarget(targetId);
    registry.select(selectedRegistryId);
    this.bindings.selectCatalogObject(selectedCatalogId);
    this.bindings.selectConstellation(selectedConstellationId);
    this.bindings.restoreSolarEclipsePresentation(registry);
    this.objectRuntime.replacePrimary(registry);
    this.bindings.rebuildDynamicRegistries();
    this.bindings.followCurrentTarget();
  }

  private resolveKnownObjectId(registry: ObjectRegistry, objectId: string | null): string | null {
    return objectId && registry.has(objectId) ? objectId : null;
  }
}
