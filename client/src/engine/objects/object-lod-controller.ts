import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import {
  type CelestialLodRepresentation,
  requestCelestialLodTextures,
} from '../materials/celestial-visual-factory';
import {
  calculateApparentRadiusPixels,
  calculateNearRepresentationBlend,
  calculateWorldDiameterForPixels,
  dampValue,
  getMinimumVisualDiameterPixels,
  shouldDisplayObjectAtLevel,
} from '../lod/screen-space-lod';
import { calculateMilkyWayTransition } from '../lod/milky-way-transition';
import { getPhotographicProfile } from '../rendering/photographic-profile';
import { PICKING_LAYER } from '../selection/selection-layers';
import { getSelectionMarkerScale } from './active-object-adornment-controller';
import { isGalaxyMapRankVisible } from './galaxy-map-policy';

interface VisibilityBlendVisual {
  setVisibilityBlend(blend: number): void;
}

export interface ObjectLodEntry {
  readonly definition: SpaceObject;
  readonly node: THREE.Group;
  readonly visualRoot: THREE.Group;
  readonly lunarEclipse: VisibilityBlendVisual | null;
  readonly solarEclipse: VisibilityBlendVisual | null;
  readonly observerCorona: THREE.Sprite | null;
  readonly lod: CelestialLodRepresentation;
  readonly farBatchIndex: number | null;
  readonly pickTarget: THREE.Object3D | null;
}

export interface ObjectLodState {
  readonly lodLevel: number;
  readonly selectedId: string | null;
  readonly navigationTargetId: string | null;
  readonly solarObserverActive: boolean;
  readonly earthObserverActive: boolean;
}

export interface ObjectLodBatch {
  updatePoint(index: number, position: THREE.Vector3, sizePixels: number, opacity: number): void;
  commit(): void;
}

export interface ObjectLodUpdateResult {
  readonly selectionMarkerScale: number | null;
}

export class ObjectLodController {
  private readonly worldPosition = new THREE.Vector3();
  private readonly localPosition = new THREE.Vector3();
  private readonly rootWorldInverse = new THREE.Matrix4();

  constructor(
    private readonly root: THREE.Group,
    private readonly entries: ReadonlyMap<string, ObjectLodEntry>,
    private readonly farBatch: ObjectLodBatch,
    private readonly quality: GraphicQuality,
  ) {}

  public update(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    state: ObjectLodState,
    deltaSeconds: number,
  ): ObjectLodUpdateResult {
    const qualityMinimumPixelDiameter =
      this.quality === 'low' ? 3.5 : this.quality === 'medium' ? 4.5 : 5;
    const photographicProfile = getPhotographicProfile(state.lodLevel, this.quality);
    const stellarObserverActive = state.earthObserverActive && !state.solarObserverActive;
    let selectionMarkerScale: number | null = null;

    this.root.updateWorldMatrix(true, false);
    this.rootWorldInverse.copy(this.root.matrixWorld).invert();

    for (const entry of this.entries.values()) {
      const selected = entry.definition.id === state.selectedId;
      const navigationTarget = entry.definition.id === state.navigationTargetId;
      const contextualGalaxy = this.isGalaxyInActiveContext(entry.definition, state);
      const contextualParent = this.isAncestorOfActiveObject(entry.definition.id, state);
      const milkyWayImpostorAllowed =
        entry.definition.id !== 'milky-way' || (state.lodLevel >= 3 && state.lodLevel <= 5);
      const keepVisible =
        (selected || navigationTarget || contextualGalaxy || contextualParent) &&
        milkyWayImpostorAllowed;
      const allowedInSolarObserver =
        !state.solarObserverActive ||
        entry.definition.id === 'sun' ||
        entry.definition.id === 'moon';
      const targetVisibility =
        !stellarObserverActive &&
        allowedInSolarObserver &&
        milkyWayImpostorAllowed &&
        shouldDisplayObjectAtLevel(entry.definition, state.lodLevel, keepVisible)
          ? 1
          : 0;
      const lod = entry.lod;
      const minimumPixelDiameter = getMinimumVisualDiameterPixels(
        entry.definition,
        state.lodLevel,
        qualityMinimumPixelDiameter,
      );

      lod.visibilityBlend = dampValue(lod.visibilityBlend, targetVisibility, 8, deltaSeconds);

      const position = entry.node.getWorldPosition(this.worldPosition);
      const distance = Math.max(camera.position.distanceTo(position), 0.001);
      const apparentRadius = calculateApparentRadiusPixels(
        entry.definition.visual.visualRadius,
        distance,
        viewportHeight,
        camera.fov,
      );
      const allowNearRepresentation =
        lod.nearRoot !== null &&
        (entry.definition.type !== 'star' || entry.definition.id === 'sun' || keepVisible);
      const targetNearBlend = allowNearRepresentation
        ? calculateNearRepresentationBlend(apparentRadius)
        : 0;

      if (targetVisibility > 0 && targetNearBlend > 0) {
        if (lod.deferredTextures.length > 0) {
          requestCelestialLodTextures(lod);
        }
        if (selected || navigationTarget) {
          for (const resource of lod.deferredResources ?? []) {
            void resource.request();
          }
        }
      }

      lod.nearBlend = dampValue(lod.nearBlend, targetNearBlend, 10, deltaSeconds);
      const nearOpacity = lod.nearBlend * lod.visibilityBlend;

      entry.lunarEclipse?.setVisibilityBlend(nearOpacity);
      entry.solarEclipse?.setVisibilityBlend(nearOpacity);
      if (entry.observerCorona) {
        entry.observerCorona.material.opacity = state.solarObserverActive ? nearOpacity * 0.32 : 0;
        entry.observerCorona.visible = state.solarObserverActive && nearOpacity > 0.008;
      }
      if (lod.nearRoot) {
        lod.nearRoot.visible = nearOpacity > 0.008;
      }
      for (const managed of lod.nearMaterials) {
        const glowRadiance = managed.material.userData['photographicGlow']
          ? photographicProfile.starRadiance
          : 1;
        const appearanceOpacity = getAppearanceOpacity(managed.material.userData);

        managed.material.opacity = Math.min(
          1,
          managed.baseOpacity * nearOpacity * glowRadiance * appearanceOpacity,
        );
        managed.material.depthWrite = managed.baseDepthWrite && nearOpacity > 0.985;
        synchronizeLayerOpacityUniform(managed.material);
      }

      const transitionOpacity =
        entry.definition.id === 'milky-way'
          ? calculateMilkyWayTransition(distance).impostorOpacity
          : 1;
      const photographicRadiance =
        entry.definition.type === 'galaxy'
          ? photographicProfile.galaxyRadiance
          : entry.definition.type === 'star'
            ? photographicProfile.starRadiance
            : 1;
      const farAppearanceOpacity = getAppearanceOpacity(lod.farSprite?.userData);
      const farOpacity = Math.min(
        1,
        lod.farBaseOpacity *
          (1 - lod.nearBlend) *
          lod.visibilityBlend *
          transitionOpacity *
          photographicRadiance *
          farAppearanceOpacity,
      );

      lod.farAlpha = farOpacity;

      const minimumWorldDiameter = calculateWorldDiameterForPixels(
        minimumPixelDiameter,
        distance,
        viewportHeight,
        camera.fov,
      );
      const useDetailedFarSprite =
        lod.farSprite !== null && (entry.farBatchIndex === null || keepVisible);

      if (lod.farSprite) {
        lod.farSprite.material.opacity = useDetailedFarSprite ? farOpacity : 0;
        lod.farSprite.visible = useDetailedFarSprite && farOpacity > 0.008;
        const farDiameter = Math.max(lod.farBaseDiameter, minimumWorldDiameter);

        lod.farSprite.scale.set(farDiameter, farDiameter * lod.farAspectRatio, 1);
      }
      if (entry.farBatchIndex !== null) {
        const farPixelDiameter = THREE.MathUtils.clamp(
          Math.max(minimumPixelDiameter, apparentRadius * 2.25),
          minimumPixelDiameter,
          28,
        );

        this.localPosition.copy(position).applyMatrix4(this.rootWorldInverse);
        this.farBatch.updatePoint(
          entry.farBatchIndex,
          this.localPosition,
          farPixelDiameter,
          useDetailedFarSprite ? 0 : farOpacity,
        );
      }
      entry.visualRoot.visible =
        lod.visibilityBlend > 0.008 &&
        (lod.nearRoot?.visible === true || lod.farSprite?.visible === true);
      if (stellarObserverActive || (state.solarObserverActive && entry.definition.id === 'earth')) {
        entry.visualRoot.visible = false;
      }

      if (entry.pickTarget) {
        const individualPickTargetVisible =
          entry.farBatchIndex === null || lod.farSprite === null || lod.farSprite.visible;

        if (lod.visibilityBlend > 0.02 && individualPickTargetVisible) {
          entry.pickTarget.layers.enable(PICKING_LAYER);
        } else {
          entry.pickTarget.layers.disable(PICKING_LAYER);
        }
      }

      if (selected) {
        selectionMarkerScale = Math.max(
          getSelectionMarkerScale(entry.definition),
          minimumWorldDiameter * 1.55,
        );
      }
    }

    this.farBatch.commit();

    return { selectionMarkerScale };
  }

  private isGalaxyInActiveContext(object: SpaceObject, state: ObjectLodState): boolean {
    if (state.lodLevel !== 3 || object.type !== 'galaxy') {
      return false;
    }
    const activeId = state.navigationTargetId ?? state.selectedId;
    const active = activeId ? this.entries.get(activeId)?.definition : undefined;

    if (active?.type !== 'galaxy') {
      return false;
    }
    const parent = active.parentId ? this.entries.get(active.parentId)?.definition : undefined;
    const hostId = parent?.type === 'galaxy' ? parent.id : active.id;

    return (
      object.id === hostId ||
      (object.parentId === hostId && isGalaxyMapRankVisible(object, this.quality))
    );
  }

  private isAncestorOfActiveObject(candidateId: string, state: ObjectLodState): boolean {
    const activeId = state.navigationTargetId ?? state.selectedId;
    let parentId = activeId ? this.entries.get(activeId)?.definition.parentId : undefined;
    const visited = new Set<string>();

    while (parentId && !visited.has(parentId)) {
      if (parentId === candidateId) {
        return true;
      }
      visited.add(parentId);
      parentId = this.entries.get(parentId)?.definition.parentId;
    }

    return false;
  }
}

function getAppearanceOpacity(userData: THREE.Object3D['userData'] | undefined): number {
  const opacity = userData?.['appearanceOpacity'];

  return typeof opacity === 'number' ? THREE.MathUtils.clamp(opacity, 0, 1) : 1;
}

function synchronizeLayerOpacityUniform(material: THREE.Material): void {
  if (!(material instanceof THREE.ShaderMaterial)) {
    return;
  }
  const layerOpacity = material.uniforms['layerOpacity'];

  if (layerOpacity) {
    layerOpacity.value = material.opacity;
  }
}
