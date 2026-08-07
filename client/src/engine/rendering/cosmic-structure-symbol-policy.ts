import { CosmicStructureType } from '../../data/models/universe.models';

export interface CosmicStructureSymbolStyle {
  readonly size: number;
  readonly alpha: number;
}

export function getCosmicStructureSymbolStyle(
  structureType: CosmicStructureType,
  catalogRadiusMpc: number,
  boundaryDistanceMpc: number,
  confidence: number,
  galaxyCount = 0,
): CosmicStructureSymbolStyle {
  if (structureType === 'void') {
    const extent = Number.isFinite(boundaryDistanceMpc)
      ? Math.max(catalogRadiusMpc, boundaryDistanceMpc)
      : catalogRadiusMpc;

    return {
      size: clamp((2.6 + Math.log1p(extent) * 1.6 + Math.log1p(galaxyCount) * 0.16) * 5.2, 30, 86),
      alpha: 0.78 + confidence * 0.18,
    };
  }
  const landmarkStyle = namedLandmarkStyle(structureType, catalogRadiusMpc, confidence);

  if (landmarkStyle) {
    return landmarkStyle;
  }
  const typeScale = structureType === 'supercluster' ? 1.08 : 1;

  return {
    size: clamp(
      (2.6 + Math.log1p(catalogRadiusMpc) * 0.8 + Math.log1p(galaxyCount) * 0.16) * typeScale,
      3.2,
      9,
    ),
    alpha: 0.28 + confidence * 0.42,
  };
}

function namedLandmarkStyle(
  structureType: CosmicStructureType,
  radiusMpc: number,
  confidence: number,
): CosmicStructureSymbolStyle | null {
  const logExtent = Math.log1p(radiusMpc);
  const styles: Partial<Record<CosmicStructureType, readonly [number, number, number]>> = {
    wall: [32 + logExtent * 4.2, 32, 72],
    basin: [26 + logExtent * 3.4, 26, 62],
    attractor: [20 + logExtent * 1.8, 20, 34],
    repeller: [22 + logExtent * 1.8, 22, 38],
  };
  const bounds = styles[structureType];

  return bounds
    ? { size: clamp(bounds[0], bounds[1], bounds[2]), alpha: 0.62 + confidence * 0.3 }
    : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
