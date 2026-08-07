import type { UniverseDataset } from '../models/universe.models';
import { parseSpaceObject } from './space-object-validator';
import { isRecord } from './validation-primitives';

export { parseManifest } from './manifest-validator';

export function parseUniverseDataset(value: unknown, source: string): UniverseDataset {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    !Array.isArray(value['objects'])
  ) {
    throw new Error(`Jeu de données invalide : ${source}.`);
  }

  return {
    version: value['version'],
    objects: value['objects'].map((object, index) => parseSpaceObject(object, source, index)),
  };
}
