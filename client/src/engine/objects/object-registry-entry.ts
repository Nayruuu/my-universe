import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import type { CelestialLodRepresentation } from '../materials/celestial-visual-factory';
import type { LunarEclipseVisual } from '../materials/lunar-eclipse-visual';
import type { SolarEclipseVisual } from '../materials/solar-eclipse-visual';
import type { SupernovaVisual } from '../materials/supernova-visual';
import type { CometActivityVisual } from '../materials/comet-activity-visual';
import type { TemporalPositionProvider } from '../simulation/position-providers';

export interface ObjectRegistryEntry {
  readonly definition: SpaceObject;
  readonly node: THREE.Group;
  readonly visualRoot: THREE.Group;
  readonly lensingForeground: THREE.Object3D | null;
  readonly rotatingBody: THREE.Object3D | null;
  readonly lunarEclipse: LunarEclipseVisual | null;
  readonly solarEclipse: SolarEclipseVisual | null;
  readonly supernova: SupernovaVisual | null;
  readonly cometActivity: CometActivityVisual | null;
  readonly observerCorona: THREE.Sprite | null;
  readonly lod: CelestialLodRepresentation;
  readonly farBatchIndex: number | null;
  readonly pickTarget: THREE.Object3D | null;
  readonly provider: TemporalPositionProvider;
}
