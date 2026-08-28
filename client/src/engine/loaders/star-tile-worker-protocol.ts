import {
  type StarClusterTilePack,
  type StarTileIndex,
  type StarTileSource,
} from '../../data/models/universe.models';
import { type StarTilePackSource } from './star-tile-source-loader';

export type StarTileWorkerRequest =
  | {
      readonly type: 'load-star-tile-index';
      readonly source: StarTileSource;
    }
  | {
      readonly type: 'load-star-tile-pack';
      readonly source: StarTilePackSource;
    };

export type StarTileWorkerResponse =
  | {
      readonly type: 'star-tile-index-loaded';
      readonly index: StarTileIndex;
    }
  | {
      readonly type: 'star-tile-pack-loaded';
      readonly pack: StarClusterTilePack;
    }
  | {
      readonly type: 'star-tile-error';
      readonly message: string;
    };

export function starClusterTilePackTransferables(pack: StarClusterTilePack): ArrayBuffer[] {
  return pack.tiles.flatMap((tile) => [
    tile.cellCoordinates.buffer as ArrayBuffer,
    tile.positionsParsec.buffer as ArrayBuffer,
    tile.starCounts.buffer as ArrayBuffer,
    tile.apparentMagnitudes.buffer as ArrayBuffer,
    tile.colorIndices.buffer as ArrayBuffer,
  ]);
}
