import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { createSelectionMarker } from '../materials/celestial-visual-factory';

export interface ActiveObjectAdornmentEntry {
  readonly definition: SpaceObject;
  readonly node: THREE.Group;
  readonly rotatingBody: THREE.Object3D | null;
}

export interface ActiveObjectAdornmentState {
  readonly selectedId: string | null;
  readonly navigationTargetId: string | null;
  readonly solarObserverActive: boolean;
  readonly solarEclipsePathActive: boolean;
  readonly solarEclipseActive: boolean;
  readonly lodLevel: number;
}

export interface ActiveObjectAdornmentDiagnostics {
  readonly selectionMarker: {
    readonly depthTest: boolean;
  };
  readonly rotationGuide: {
    readonly visible: boolean;
    readonly objectId: string | null;
    readonly direction: string | null;
    readonly style: string | null;
    readonly parentName: string | null;
    readonly directionScale: number;
    readonly vertexCount: number;
    readonly hasVertexColors: boolean;
  };
}

export class ActiveObjectAdornmentController {
  public readonly selectionMarker = createSelectionMarker();
  public readonly rotationGuide: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  constructor(
    root: THREE.Group,
    private readonly entries: ReadonlyMap<string, ActiveObjectAdornmentEntry>,
    quality: GraphicQuality,
  ) {
    this.rotationGuide = createRotationGuide(quality);
    root.add(this.rotationGuide);
  }

  public select(objectId: string | null): void {
    this.selectionMarker.removeFromParent();
    const entry = objectId ? this.entries.get(objectId) : undefined;

    if (!entry) {
      return;
    }
    this.selectionMarker.scale.setScalar(getSelectionMarkerScale(entry.definition));
    if (entry.definition.type !== 'region') {
      entry.node.add(this.selectionMarker);
    }
  }

  public setSelectionMarkerScale(scale: number | null): void {
    if (scale !== null) {
      this.selectionMarker.scale.setScalar(scale);
    }
  }

  public update(state: ActiveObjectAdornmentState): void {
    this.updateRotationGuide(state);
    const selected = state.selectedId ? this.entries.get(state.selectedId) : undefined;

    this.selectionMarker.visible =
      selected?.definition.type !== 'black-hole' &&
      state.lodLevel < 2 &&
      !state.solarObserverActive &&
      !state.solarEclipsePathActive &&
      !state.solarEclipseActive &&
      !this.rotationGuide.visible;
  }

  public getDiagnostics(): ActiveObjectAdornmentDiagnostics {
    const objectId = this.rotationGuide.userData['objectId'];
    const direction = this.rotationGuide.userData['direction'];
    const style = this.rotationGuide.userData['style'];
    const positionAttribute = this.rotationGuide.geometry.getAttribute('position');
    const colorAttribute = this.rotationGuide.geometry.getAttribute('color');

    return {
      selectionMarker: {
        depthTest: this.selectionMarker.material.depthTest,
      },
      rotationGuide: {
        visible: this.rotationGuide.visible,
        objectId: typeof objectId === 'string' ? objectId : null,
        direction: typeof direction === 'string' ? direction : null,
        style: typeof style === 'string' ? style : null,
        parentName: this.rotationGuide.parent?.name ?? null,
        directionScale: this.rotationGuide.scale.z,
        vertexCount: positionAttribute?.count ?? 0,
        hasVertexColors:
          colorAttribute !== undefined && colorAttribute.count === positionAttribute?.count,
      },
    };
  }

  public dispose(): void {
    this.selectionMarker.removeFromParent();
    this.selectionMarker.material.map?.dispose();
    this.selectionMarker.material.dispose();
  }

  private updateRotationGuide(state: ActiveObjectAdornmentState): void {
    const entry = this.getActiveRotatingEntry(state);
    const rotation = entry?.definition.rotation;

    if (!entry?.rotatingBody || !rotation) {
      this.rotationGuide.visible = false;
      this.rotationGuide.userData['objectId'] = null;

      return;
    }
    entry.rotatingBody.add(this.rotationGuide);
    this.rotationGuide.scale.set(1, 1, rotation.direction === 'retrograde' ? -1 : 1);
    this.rotationGuide.material.color.set(
      entry.definition.visual.atmosphereColor ?? entry.definition.visual.color ?? 0x8acff4,
    );
    this.rotationGuide.userData['objectId'] = entry.definition.id;
    this.rotationGuide.userData['direction'] = rotation.direction;
    this.rotationGuide.visible = !state.solarObserverActive && state.lodLevel === 0;
  }

  private getActiveRotatingEntry(
    state: ActiveObjectAdornmentState,
  ): ActiveObjectAdornmentEntry | null {
    const selected = state.selectedId ? this.entries.get(state.selectedId) : undefined;

    if (selected?.rotatingBody && selected.definition.rotation) {
      return selected;
    }
    const target = state.navigationTargetId
      ? this.entries.get(state.navigationTargetId)
      : undefined;

    return target?.rotatingBody && target.definition.rotation ? target : null;
  }
}

export function getSelectionMarkerScale(object: SpaceObject): number {
  const radius = object.visual.visualRadius;

  return object.type === 'galaxy'
    ? radius * 0.5
    : object.type === 'black-hole'
      ? radius * 5.2
      : radius * 3.3;
}

function createRotationGuide(
  quality: GraphicQuality,
): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const segments = quality === 'low' ? 40 : quality === 'medium' ? 56 : 72;
  const radius = 1.38;
  const positions: number[] = [];
  const colors: number[] = [];

  for (let index = 0; index < segments; index += 1) {
    const start = (index / segments) * Math.PI * 2;
    const end = ((index + 1) / segments) * Math.PI * 2;
    const startIntensity = getRotationRingIntensity(start);
    const endIntensity = getRotationRingIntensity(end);

    positions.push(
      Math.cos(start) * radius,
      0,
      Math.sin(start) * radius,
      Math.cos(end) * radius,
      0,
      Math.sin(end) * radius,
    );
    colors.push(
      startIntensity,
      startIntensity,
      startIntensity,
      endIntensity,
      endIntensity,
      endIntensity,
    );
  }
  positions.push(0, -1.62, 0, 0, 1.62, 0);
  colors.push(0.24, 0.24, 0.24, 0.24, 0.24, 0.24);
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const guide = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x8acff4,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  guide.name = 'active-rotation-guide';
  guide.visible = false;
  guide.renderOrder = 4;
  guide.userData['kind'] = 'rotation-guide';
  guide.userData['style'] = 'moving-highlight';
  guide.userData['objectId'] = null;

  return guide;
}

function getRotationRingIntensity(angle: number): number {
  const distanceFromHighlight = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  const highlightWidth = Math.PI * 0.26;
  const normalizedDistance = Math.min(distanceFromHighlight / highlightWidth, 1);
  const highlight = Math.cos((normalizedDistance * Math.PI) / 2) ** 2;

  return 0.18 + highlight * 0.82;
}
