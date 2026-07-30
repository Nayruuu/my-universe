export const HYG_STAR_CATALOG_ID = 'hyg-v41-bright-stars';

export function extractFeaturedCatalogIdentifiers(dataset) {
  if (!dataset || !Array.isArray(dataset.objects)) {
    throw new Error('Featured star dataset is missing its objects array.');
  }

  const identifiers = new Set();

  for (const object of dataset.objects) {
    const provider = object?.positionProvider;
    const identifier =
      provider?.type === 'catalog' && provider.catalogId === HYG_STAR_CATALOG_ID
        ? normalizeIdentifier(provider.identifier)
        : null;

    if (!identifier) {
      throw new Error(`Featured star ${object?.id ?? 'unknown'} has no valid HYG link.`);
    }
    if (identifiers.has(identifier)) {
      throw new Error(`Duplicate featured HYG identifier: ${provider.identifier}.`);
    }
    identifiers.add(identifier);
  }

  return identifiers;
}

export function selectBrightestIncludingIdentifiers(stars, limit, featuredIdentifiers) {
  if (!Number.isInteger(limit) || limit <= 0 || featuredIdentifiers.size > limit) {
    throw new Error('The HYG selection limit cannot contain all featured stars.');
  }

  const featuredByIdentifier = new Map();

  for (const star of stars) {
    for (const identifier of [star.name, ...star.aliases].map(normalizeIdentifier)) {
      if (featuredIdentifiers.has(identifier) && !featuredByIdentifier.has(identifier)) {
        featuredByIdentifier.set(identifier, star);
      }
    }
  }
  const missingIdentifiers = [...featuredIdentifiers].filter(
    (identifier) => !featuredByIdentifier.has(identifier),
  );

  if (missingIdentifiers.length > 0) {
    throw new Error(`Featured identifiers absent from HYG: ${missingIdentifiers.join(', ')}.`);
  }

  const selectedIds = new Set([...featuredByIdentifier.values()].map((star) => star.id));
  const remaining = stars
    .filter((star) => !selectedIds.has(star.id))
    .sort(compareStars)
    .slice(0, limit - selectedIds.size);

  return [
    ...new Map([...featuredByIdentifier.values()].map((star) => [star.id, star])).values(),
    ...remaining,
  ]
    .slice(0, limit)
    .sort(compareStars);
}

function compareStars(left, right) {
  return left.magnitude - right.magnitude || left.id - right.id;
}

function normalizeIdentifier(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ').toUpperCase() : '';
}
