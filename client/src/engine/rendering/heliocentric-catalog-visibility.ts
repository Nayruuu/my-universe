const FULL_VISIBILITY_RADIUS_RATIO = 0.55;
const HIDDEN_RADIUS_RATIO = 0.8;

export function getHeliocentricCatalogObserverOpacity(
  observerDistance: number,
  catalogRadius: number,
): number {
  if (!Number.isFinite(observerDistance) || !Number.isFinite(catalogRadius) || catalogRadius <= 0) {
    return 1;
  }
  const radiusRatio = Math.max(0, observerDistance) / catalogRadius;
  const progress = Math.min(
    1,
    Math.max(
      0,
      (radiusRatio - FULL_VISIBILITY_RADIUS_RATIO) /
        (HIDDEN_RADIUS_RATIO - FULL_VISIBILITY_RADIUS_RATIO),
    ),
  );
  const smoothProgress = progress * progress * (3 - 2 * progress);

  return 1 - smoothProgress;
}
