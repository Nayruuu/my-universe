import * as THREE from 'three';
import { type ConstellationCatalog, type SpaceObject } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';
import { ConstellationVisual } from './constellation-visual';

const LOD_OPACITIES = [0.08, 0.14, 0.23, 0, 0, 0] as const;
const HOVER_HIGHLIGHT_OPACITY = 0.74;
const SELECTED_HIGHLIGHT_OPACITY = 0.98;
const HOVER_HIGHLIGHT_COLOR = 0xaee5ff;
const SELECTED_HIGHLIGHT_COLOR = 0xe5fbff;

export class ConstellationBatch {
  public readonly root: THREE.Group;
  public readonly lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  public readonly highlightLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  public readonly definitions: readonly SpaceObject[];

  private readonly visual: ConstellationVisual;
  private enabled = true;
  private opacity = 0;
  private highlightOpacity = 0;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;

  constructor(catalog: ConstellationCatalog, registry: StarCatalogRegistry) {
    this.visual = new ConstellationVisual(catalog, registry);
    this.root = this.visual.root;
    this.lines = this.visual.lines;
    this.highlightLines = this.visual.highlightLines;
    this.definitions = this.visual.definitions;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateVisibility();
  }

  public has(objectId: string): boolean {
    return this.visual.has(objectId);
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    return this.visual.getDefinition(objectId);
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    return this.visual.getWorldPosition(objectId, target);
  }

  public getFocusRadius(objectId: string): number | null {
    return this.visual.getFocusRadius(objectId);
  }

  public getPickables(): readonly THREE.Object3D[] {
    return this.lines.visible ? [this.lines] : [];
  }

  public select(objectId: string | null): void {
    this.selectedId = this.normalizeFigureId(objectId);
    this.applyActiveFigure();
  }

  public hover(objectId: string | null): void {
    this.hoveredId = this.normalizeFigureId(objectId);
    this.applyActiveFigure();
  }

  public updateLod(lodLevel: number, deltaSeconds: number): void {
    const lodOpacity = LOD_OPACITIES[lodLevel] ?? 0;
    const targetOpacity = this.enabled ? lodOpacity : 0;
    const activeFigure = this.highlightLines.geometry.drawRange.count > 0;
    const selectedFigure =
      activeFigure && this.highlightLines.userData['objectId'] === this.selectedId;
    const targetHighlightOpacity =
      this.enabled && activeFigure && lodOpacity > 0
        ? selectedFigure
          ? SELECTED_HIGHLIGHT_OPACITY
          : HOVER_HIGHLIGHT_OPACITY
        : 0;

    this.opacity = dampValue(this.opacity, targetOpacity, 7, deltaSeconds);
    this.highlightOpacity = dampValue(
      this.highlightOpacity,
      targetHighlightOpacity,
      9,
      deltaSeconds,
    );
    this.lines.material.opacity = this.opacity;
    this.highlightLines.material.opacity = this.highlightOpacity;
    this.highlightLines.material.color.setHex(
      selectedFigure ? SELECTED_HIGHLIGHT_COLOR : HOVER_HIGHLIGHT_COLOR,
    );
    this.updateVisibility();
  }

  public updatePositions(): void {
    this.visual.updatePositions();
  }

  public dispose(): void {
    this.visual.dispose();
  }

  private normalizeFigureId(objectId: string | null): string | null {
    return objectId && this.visual.has(objectId) ? objectId : null;
  }

  private applyActiveFigure(): void {
    this.visual.showHighlight(this.hoveredId ?? this.selectedId);
    this.updateVisibility();
  }

  private updateVisibility(): void {
    this.lines.visible = this.enabled && this.opacity > 0.004;
    this.highlightLines.visible =
      this.enabled &&
      this.highlightOpacity > 0.004 &&
      this.highlightLines.geometry.drawRange.count > 0;
  }
}
