import * as THREE from 'three';
import type {
  GraphicQuality,
  PositionProviderDefinition,
  SpaceObject,
} from '../../data/models/universe.models';
import type { TemporalPositionProvider } from '../simulation/position-providers';
import { getSolarSystemMapAccent } from './solar-system-map-palette';

type OrbitalPositionDefinition = Extract<
  PositionProviderDefinition,
  { type: 'keplerian' | 'ephemeris' | 'illustrative-orbit' }
>;

export interface OrbitObjectEntry {
  readonly definition: SpaceObject;
  readonly node: THREE.Group;
  readonly provider: TemporalPositionProvider;
}

export interface OrbitVisualState {
  readonly showOrbits: boolean;
  readonly solarObserverActive: boolean;
  readonly lodLevel: number;
  readonly selectedId: string | null;
  readonly navigationTargetId: string | null;
}

interface OrbitVisual {
  readonly entry: OrbitObjectEntry;
  readonly line: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly radius: number;
  readonly baseColor: number;
  readonly baseOpacity: number;
  readonly mapColor: string;
  readonly activeMapColor: string;
}

const SOLAR_SYSTEM_ORBIT_TYPES = new Set<SpaceObject['type']>([
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
]);

export class OrbitVisualManager {
  private readonly visuals = new Map<string, OrbitVisual>();

  constructor(
    private readonly root: THREE.Group,
    private readonly entries: ReadonlyMap<string, OrbitObjectEntry>,
    private readonly quality: GraphicQuality,
  ) {}

  public getRadius(objectId: string): number | null {
    this.ensureVisual(objectId);

    return this.visuals.get(objectId)?.radius ?? null;
  }

  public update(state: OrbitVisualState): void {
    this.synchronizeVisuals(state);
    const activeOrbitId = this.getActiveOrbitId(state);
    const orbitsAllowed = state.showOrbits && !state.solarObserverActive;

    for (const [objectId, orbit] of this.visuals) {
      const active = objectId === activeOrbitId;
      const overviewEmphasis = state.lodLevel === 1;
      const solarSystemOrbit =
        state.lodLevel <= 2 && SOLAR_SYSTEM_ORBIT_TYPES.has(orbit.entry.definition.type);

      orbit.line.visible =
        orbitsAllowed && (state.lodLevel <= 1 || (active && state.lodLevel <= 2));
      orbit.line.material.color.set(
        solarSystemOrbit
          ? active
            ? orbit.activeMapColor
            : orbit.mapColor
          : active || overviewEmphasis
            ? (orbit.entry.definition.visual.color ?? 0x8acff4)
            : orbit.baseColor,
      );
      orbit.line.material.opacity = active ? 0.92 : overviewEmphasis ? 0.62 : orbit.baseOpacity;
      orbit.line.material.linewidth = active ? 1.6 : overviewEmphasis ? 1.35 : 1;
      orbit.line.renderOrder = active ? 3 : overviewEmphasis ? 1 : 0;
      orbit.line.userData['active'] = active;
      orbit.line.userData['overviewEmphasis'] = overviewEmphasis;
      orbit.line.userData['semanticGroup'] = solarSystemOrbit ? 'solar-system' : null;
      orbit.line.userData['mapAccent'] = solarSystemOrbit ? orbit.mapColor : null;
    }
  }

  public dispose(): void {
    for (const visual of this.visuals.values()) {
      disposeOrbitVisual(visual);
    }
    this.visuals.clear();
  }

  private synchronizeVisuals(state: OrbitVisualState): void {
    const requiredIds = this.getRequiredIds(state);

    for (const objectId of requiredIds) {
      this.ensureVisual(objectId);
    }
    for (const [objectId, visual] of [...this.visuals]) {
      if (!requiredIds.has(objectId)) {
        disposeOrbitVisual(visual);
        this.visuals.delete(objectId);
      }
    }
  }

  private getRequiredIds(state: OrbitVisualState): Set<string> {
    const requiredIds = new Set<string>();

    if (!state.showOrbits || state.solarObserverActive) {
      return requiredIds;
    }
    if (state.lodLevel <= 1) {
      for (const entry of this.entries.values()) {
        if (isOrbitalDefinition(entry.definition.positionProvider)) {
          requiredIds.add(entry.definition.id);
        }
      }

      return requiredIds;
    }
    if (state.lodLevel <= 2) {
      const activeOrbitId = this.getActiveOrbitId(state);

      if (activeOrbitId) {
        requiredIds.add(activeOrbitId);
      }
    }

    return requiredIds;
  }

  private ensureVisual(objectId: string): void {
    if (this.visuals.has(objectId)) {
      return;
    }
    const entry = this.entries.get(objectId);
    const definition = entry?.definition.positionProvider;

    if (!entry || !definition || !isOrbitalDefinition(definition)) {
      return;
    }
    this.visuals.set(objectId, this.createVisual(entry, definition));
  }

  private createVisual(
    entry: OrbitObjectEntry,
    definition: OrbitalPositionDefinition,
  ): OrbitVisual {
    const segments = getOrbitSegmentCount(this.quality, entry.definition.type === 'moon');
    const epochJulianDay =
      definition.type === 'ephemeris' ? definition.orbitEpochJulianDay : definition.epochJulianDay;
    const points: THREE.Vector3[] = [];

    for (let index = 0; index < segments; index += 1) {
      const julianDay = epochJulianDay + (index / segments) * definition.orbitalPeriodDays;
      const position = entry.provider.getPositionAt({ julianDay });

      points.push(new THREE.Vector3(position.x, position.y, position.z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const baseColor = entry.definition.type === 'moon' ? 0x718097 : 0x465266;
    const baseOpacity = entry.definition.type === 'moon' ? 0.5 : 0.34;
    const material = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
    });
    const line = new THREE.LineLoop(geometry, material);

    line.name = `${entry.definition.id}-orbit`;
    line.userData['kind'] = 'orbit';
    const parent = entry.definition.parentId
      ? this.entries.get(entry.definition.parentId)?.node
      : undefined;

    (parent ?? this.root).add(line);

    return {
      entry,
      line,
      radius: points.reduce((maximum, point) => Math.max(maximum, point.length()), 0),
      baseColor,
      baseOpacity,
      mapColor: getSolarSystemMapAccent(entry.definition.id, false),
      activeMapColor: getSolarSystemMapAccent(entry.definition.id, true),
    };
  }

  private getActiveOrbitId(state: OrbitVisualState): string | null {
    const selected = state.selectedId ? this.entries.get(state.selectedId) : undefined;

    return selected &&
      isOrbitalDefinition(selected.definition.positionProvider) &&
      selected.definition.parentId === state.navigationTargetId
      ? selected.definition.id
      : null;
  }
}

function isOrbitalDefinition(
  definition: PositionProviderDefinition,
): definition is OrbitalPositionDefinition {
  return (
    definition.type === 'keplerian' ||
    definition.type === 'ephemeris' ||
    definition.type === 'illustrative-orbit'
  );
}

function getOrbitSegmentCount(quality: GraphicQuality, moon: boolean): number {
  if (quality === 'low') {
    return moon ? 48 : 96;
  }
  if (quality === 'medium') {
    return moon ? 72 : 144;
  }

  return moon ? 96 : 180;
}

function disposeOrbitVisual(visual: OrbitVisual): void {
  visual.line.removeFromParent();
  visual.line.geometry.dispose();
  visual.line.material.dispose();
}
