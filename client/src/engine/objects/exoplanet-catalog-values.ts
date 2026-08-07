export function stableCatalogHash(value: string): number {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function finiteCatalogValue(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

export function nonZeroCatalogValue(value: number): number | undefined {
  return value === 0 ? undefined : value;
}

export function isPositiveFiniteCatalogValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function compactDefinedValues<T extends Record<string, unknown>>(
  value: T,
): {
  [Key in keyof T]?: Exclude<T[Key], undefined>;
} {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [Key in keyof T]?: Exclude<T[Key], undefined>;
  };
}
