import { invalidExoplanetCatalog } from './exoplanet-catalog-format';

export interface ExoplanetStringDecoder {
  decode(relativeOffset: number, recordIndex: number): string;
}

export function createExoplanetStringDecoder(
  view: DataView,
  offset: number,
  length: number,
): ExoplanetStringDecoder {
  const bytes = new Uint8Array(view.buffer, offset, length);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const cache = new Map<number, string>();

  return {
    decode(relativeOffset: number, recordIndex: number): string {
      const cached = cache.get(relativeOffset);

      if (cached !== undefined) {
        return cached;
      }
      if (relativeOffset >= bytes.length) {
        throw invalidExoplanetCatalog(`offset de chaîne invalide à l’index ${recordIndex}`);
      }
      let end = relativeOffset;

      while (end < bytes.length && bytes[end] !== 0) {
        end += 1;
      }
      if (end >= bytes.length) {
        throw invalidExoplanetCatalog(`chaîne non terminée à l’index ${recordIndex}`);
      }
      try {
        const value = decoder.decode(bytes.subarray(relativeOffset, end));

        cache.set(relativeOffset, value);

        return value;
      } catch {
        throw invalidExoplanetCatalog(`chaîne UTF-8 invalide à l’index ${recordIndex}`);
      }
    },
  };
}
