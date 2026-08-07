import { type TempelFilamentSpineSource } from '../../data/models/universe.models';
import {
  type TempelFilamentSpineCatalog,
  type TempelFilamentSpineCatalogLoadMetrics,
} from './tempel-filament-spine-catalog';
import { tempelFilamentSpineRenderDataTransferables } from './tempel-filament-spine-render-data';

export const TEMPEL_FILAMENT_SCENE_UNITS_PER_MPC = 200;

export interface TempelFilamentSpineWorkerRequest {
  readonly type: 'load-tempel-filament-spines';
  readonly source: TempelFilamentSpineSource;
}

export type TempelFilamentSpineWorkerResponse =
  | {
      readonly type: 'tempel-filament-spines-loaded';
      readonly catalog: TempelFilamentSpineCatalog;
      readonly metrics: TempelFilamentSpineCatalogLoadMetrics;
    }
  | {
      readonly type: 'tempel-filament-spines-error';
      readonly message: string;
    };

export function tempelFilamentSpineCatalogTransferables(
  catalog: TempelFilamentSpineCatalog,
): ArrayBuffer[] {
  return [
    catalog.filamentIds.buffer,
    catalog.pointOffsets.buffer,
    catalog.positionsMpc.buffer,
    catalog.visitMap.buffer,
    catalog.density.buffer,
    catalog.orientationStrength.buffer,
    ...(catalog.renderData ? tempelFilamentSpineRenderDataTransferables(catalog.renderData) : []),
  ];
}
