import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';

export interface EarthObserverLocationLabel {
  readonly primary: string;
  readonly secondary: string;
}

export function earthObserverLocationLabel(
  location: EarthObserverLocation,
  locale: string,
): EarthObserverLocationLabel {
  return {
    primary: location.name,
    secondary: location.countryCode ? regionName(location.countryCode, locale) : '',
  };
}

export function suggestEarthObserverLocations(
  locations: readonly EarthObserverLocation[],
  query: string,
  locale: string,
  maximumResults: number,
): readonly EarthObserverLocation[] {
  const limit = Math.max(0, Math.floor(maximumResults));

  if (limit === 0) {
    return [];
  }
  const normalizedQuery = normalizeSearchText(query);
  const scored = locations.flatMap((location) => {
    const label = earthObserverLocationLabel(location, locale);
    const searchable = normalizeSearchText(
      `${location.name} ${label.secondary} ${location.countryCode ?? ''}`,
    );

    if (normalizedQuery && !searchable.includes(normalizedQuery)) {
      return [];
    }

    return [
      {
        location,
        score: location.population ?? 0,
      },
    ];
  });

  return scored
    .sort(
      (left, right) =>
        right.score - left.score || left.location.name.localeCompare(right.location.name, locale),
    )
    .slice(0, limit)
    .map(({ location }) => location);
}

function regionName(countryCode: string, locale: string): string {
  return new Intl.DisplayNames(locale, { type: 'region' }).of(countryCode)!;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase();
}
