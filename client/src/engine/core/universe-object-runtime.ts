import * as THREE from 'three';
import { type DisplayOptions, type SpaceObject } from '../../data/models/universe.models';
import { type ObjectRegistry } from '../objects/object-registry';
import type { EarthObserverCelestialPresentation } from '../objects/earth-observer-celestial-presenter';
import type { ObjectVisualDiagnostics } from '../objects/object-visual-diagnostics';

export class UniverseObjectRuntime {
  private primary: ObjectRegistry | null = null;
  private streamed: ObjectRegistry | null = null;
  private exoplanetSystem: ObjectRegistry | null = null;
  private earthObserverCelestialPresentations: readonly EarthObserverCelestialPresentation[] = [];

  public get primaryRegistry(): ObjectRegistry | null {
    return this.primary;
  }

  public get streamedRegistry(): ObjectRegistry | null {
    return this.streamed;
  }

  public get exoplanetSystemRegistry(): ObjectRegistry | null {
    return this.exoplanetSystem;
  }

  public replacePrimary(registry: ObjectRegistry | null): void {
    this.primary = this.replace(this.primary, registry);
    this.primary?.setEarthObserverCelestialPresentations(this.earthObserverCelestialPresentations);
  }

  public replaceStreamed(registry: ObjectRegistry | null): void {
    this.streamed = this.replace(this.streamed, registry);
  }

  public replaceExoplanetSystem(registry: ObjectRegistry | null): void {
    this.exoplanetSystem = this.replace(this.exoplanetSystem, registry);
  }

  public has(objectId: string): boolean {
    return this.getRegistry(objectId) !== null;
  }

  public getRegistry(objectId: string): ObjectRegistry | null {
    return this.registries.find((registry) => registry.has(objectId)) ?? null;
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    for (const registry of this.registries) {
      const definition = registry.getDefinition(objectId);

      if (definition) {
        return definition;
      }
    }

    return undefined;
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    for (const registry of this.registries) {
      const position = registry.getWorldPosition(objectId, target);

      if (position) {
        return position;
      }
    }

    return null;
  }

  public getVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null {
    return this.getRegistry(objectId)?.getVisualDiagnostics(objectId) ?? null;
  }

  public getPickables(): readonly THREE.Object3D[] {
    return this.registries.flatMap((registry) => registry.getPickables());
  }

  public setNavigationTarget(objectId: string | null): void {
    for (const registry of this.registries) {
      registry.setNavigationTarget(this.objectIdForRegistry(registry, objectId));
    }
  }

  public select(objectId: string | null): void {
    for (const registry of this.registries) {
      registry.select(this.objectIdForRegistry(registry, objectId));
    }
  }

  public setDisplayOptions(options: DisplayOptions): void {
    for (const registry of this.registries) {
      registry.setDisplayOptions(options);
    }
  }

  public setEarthObserverCelestialPresentations(
    presentations: readonly EarthObserverCelestialPresentation[],
  ): void {
    this.earthObserverCelestialPresentations = presentations;
    this.primary?.setEarthObserverCelestialPresentations(presentations);
  }

  public updateLod(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    lodLevel: number,
    deltaSeconds: number,
    earthObserverActive = false,
  ): void {
    for (const registry of this.registries) {
      registry.updateLod(camera, viewportHeight, lodLevel, deltaSeconds, earthObserverActive);
    }
  }

  public updateReferenceFrameScale(cameraDistance: number): boolean {
    let changed = false;

    for (const registry of this.registries) {
      changed = registry.updateReferenceFrameScale(cameraDistance) || changed;
    }

    return changed;
  }

  public get visibleObjectCount(): number {
    return this.registries.reduce((total, registry) => total + registry.visibleObjectCount, 0);
  }

  public get batchedGalaxyCount(): number {
    return this.registries.reduce((total, registry) => total + registry.batchedGalaxyCount, 0);
  }

  public dispose(): void {
    this.earthObserverCelestialPresentations = [];
    this.replacePrimary(null);
    this.replaceStreamed(null);
    this.replaceExoplanetSystem(null);
  }

  private get registries(): readonly ObjectRegistry[] {
    return [this.primary, this.streamed, this.exoplanetSystem].filter(
      (registry): registry is ObjectRegistry => registry !== null,
    );
  }

  private replace(
    current: ObjectRegistry | null,
    next: ObjectRegistry | null,
  ): ObjectRegistry | null {
    if (current !== next) {
      current?.dispose();
    }

    return next;
  }

  private objectIdForRegistry(registry: ObjectRegistry, objectId: string | null): string | null {
    return objectId !== null && registry.has(objectId) ? objectId : null;
  }
}
