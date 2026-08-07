import { type SpaceObject } from '../../data/models/universe.models';

export interface UniverseSelectionBindings {
  ensureActiveExoplanetSystem(objectId: string): void;
  getDefinition(objectId: string): SpaceObject | undefined;
  hasDetailedObject(objectId: string): boolean;
  isCatalogObject(objectId: string): boolean;
  isConstellation(objectId: string): boolean;
  selectDetailedObject(objectId: string | null): void;
  selectCatalogObject(objectId: string | null): void;
  selectConstellation(objectId: string | null): void;
  setTransientObject(object: SpaceObject | null): void;
  setDetailsPanelVisible(visible: boolean): void;
  ensureTempelFilamentSpines(): void;
  emitSelected(objectId: string | null, object: SpaceObject | null): void;
  setTarget(objectId: string): void | Promise<void>;
}

export class UniverseSelectionRuntime {
  private selected: string | null = null;

  constructor(private readonly bindings: UniverseSelectionBindings) {}

  public get selectedId(): string | null {
    return this.selected;
  }

  public restoreSelectedId(objectId: string | null): void {
    this.selected = objectId;
  }

  public select(objectId: string | null): void {
    if (objectId) {
      this.bindings.ensureActiveExoplanetSystem(objectId);
    }
    const object = objectId ? (this.bindings.getDefinition(objectId) ?? null) : null;

    if (objectId && !object) {
      return;
    }
    this.selected = objectId;
    const detailedObjectId =
      objectId && this.bindings.hasDetailedObject(objectId) ? objectId : null;
    const catalogObjectId =
      objectId && !detailedObjectId && this.bindings.isCatalogObject(objectId) ? objectId : null;
    const constellationObjectId =
      objectId && this.bindings.isConstellation(objectId) ? objectId : null;

    this.bindings.selectDetailedObject(detailedObjectId);
    this.bindings.selectCatalogObject(catalogObjectId);
    this.bindings.selectConstellation(constellationObjectId);
    this.bindings.setTransientObject(catalogObjectId ? object : null);
    this.bindings.setDetailsPanelVisible(objectId !== null);
    if (object?.type === 'cosmic-filament') {
      this.bindings.ensureTempelFilamentSpines();
    }
    this.bindings.emitSelected(objectId, object);
  }

  public focusSelected(): void {
    if (this.selected) {
      void this.bindings.setTarget(this.selected);
    }
  }
}
