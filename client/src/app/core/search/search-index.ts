import { SearchEntry, SpaceObject } from '../../../data/models/universe.models';

interface IndexedSearchEntry {
  entry: SearchEntry;
  normalizedName: string;
  normalizedAliases: string[];
  normalizedKeywords: string[];
}

const GREEK_SEARCH_NAMES: Readonly<Record<string, string>> = {
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'epsilon',
  ζ: 'zeta',
  η: 'eta',
  θ: 'theta',
  ι: 'iota',
  κ: 'kappa',
  λ: 'lambda',
  μ: 'mu',
  ν: 'nu',
  ξ: 'xi',
  ο: 'omicron',
  π: 'pi',
  ρ: 'rho',
  σ: 'sigma',
  τ: 'tau',
  υ: 'upsilon',
  φ: 'phi',
  χ: 'chi',
  ψ: 'psi',
  ω: 'omega',
};

export class LocalSearchIndex {
  private entries: IndexedSearchEntry[] = [];

  public build(
    objects: readonly SpaceObject[],
    additionalEntries: readonly SearchEntry[] = [],
  ): void {
    const names = new Map(objects.map((object) => [object.id, object.name]));
    const objectEntries = objects.map((object): SearchEntry => ({
      id: object.id,
      name: object.name,
      aliases: object.aliases ?? [],
      type: object.type,
      parentName: object.parentId ? names.get(object.parentId) : undefined,
      keywords: [
        object.type,
        object.referenceFrame,
        ...(object.metadata?.['keywords'] ? String(object.metadata['keywords']).split(/\s+/) : []),
      ],
      metadata: object.metadata,
    }));

    this.entries = [...objectEntries, ...additionalEntries].map(indexEntry);
  }

  public search(query: string, limit = 8): SearchEntry[] {
    const normalizedQuery = normalizeSearchText(query.trim());

    if (!normalizedQuery) {
      return [];
    }

    const matches: { entry: SearchEntry; score: number }[] = [];

    for (const indexed of this.entries) {
      const result = {
        entry: indexed.entry,
        score: scoreEntry(indexed, normalizedQuery),
      };

      if (Number.isFinite(result.score)) {
        insertRanked(matches, result, limit);
      }
    }

    return matches.map((result) => result.entry);
  }
}

function indexEntry(entry: SearchEntry): IndexedSearchEntry {
  return {
    entry,
    normalizedName: normalizeSearchText(entry.name),
    normalizedAliases: entry.aliases.map(normalizeSearchText),
    normalizedKeywords: (entry.keywords ?? []).map(normalizeSearchText),
  };
}

function insertRanked(
  matches: { entry: SearchEntry; score: number }[],
  result: { entry: SearchEntry; score: number },
  limit: number,
): void {
  if (limit <= 0) {
    return;
  }
  const insertionIndex = matches.findIndex((candidate) => compareResults(result, candidate) < 0);

  matches.splice(insertionIndex < 0 ? matches.length : insertionIndex, 0, result);
  if (matches.length > limit) {
    matches.pop();
  }
}

function compareResults(
  left: { entry: SearchEntry; score: number },
  right: { entry: SearchEntry; score: number },
): number {
  return left.score - right.score || left.entry.name.localeCompare(right.entry.name);
}

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('fr')
    .replace(/[α-ω]/gu, (letter) => ` ${GREEK_SEARCH_NAMES[letter] ?? letter} `)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['’_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreEntry(entry: IndexedSearchEntry, query: string): number {
  if (entry.normalizedName === query) {
    return 0;
  }
  if (entry.normalizedAliases.includes(query)) {
    return 1;
  }
  if (entry.normalizedName.startsWith(query)) {
    return 2 + entry.normalizedName.length / 1_000;
  }
  if (entry.normalizedAliases.some((alias) => alias.startsWith(query))) {
    return 3;
  }
  if (entry.normalizedName.includes(query)) {
    return 4;
  }
  if (entry.normalizedAliases.some((alias) => alias.includes(query))) {
    return 5;
  }
  if (entry.normalizedKeywords.some((keyword) => keyword.includes(query))) {
    return 6;
  }

  return Number.POSITIVE_INFINITY;
}
