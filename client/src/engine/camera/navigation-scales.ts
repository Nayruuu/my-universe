export type NavigationScaleId =
  | 'planetary'
  | 'solar-system'
  | 'stellar-neighborhood'
  | 'milky-way'
  | 'local-group'
  | 'nearby-universe'
  | 'cosmic-web';

export interface NavigationScaleDefinition {
  id: NavigationScaleId;
  label: string;
  description: string;
  targetId: string;
  distance: number;
  lodLevel: number;
  direction: readonly [number, number, number];
}

/**
 * Camera distance at which the illustrative Milky Way envelope becomes immersive. The canonical
 * Galactic reference frame, navigation distance, and wheel response remain independent from that
 * visual enlargement.
 */
export const MILKY_WAY_NAVIGATION_DISTANCE = 3_600;

export const NAVIGATION_SCALES: readonly NavigationScaleDefinition[] = [
  {
    id: 'planetary',
    label: 'Planétaire',
    description: 'Revenir près de la Terre',
    targetId: 'earth',
    distance: 4.8,
    lodLevel: 0,
    direction: [1, 0.55, 1],
  },
  {
    id: 'solar-system',
    label: 'Système solaire',
    description: 'Parcourir les orbites planétaires',
    targetId: 'sun',
    distance: 520,
    lodLevel: 1,
    direction: [1, 0.68, 1],
  },
  {
    id: 'stellar-neighborhood',
    label: 'Voisinage stellaire',
    description: 'Découvrir les étoiles proches',
    targetId: 'sun',
    distance: 1_400,
    lodLevel: 2,
    direction: [1, 0.42, 1],
  },
  {
    id: 'milky-way',
    label: 'Voie lactée',
    description: 'Observer la structure galactique',
    targetId: 'milky-way',
    distance: MILKY_WAY_NAVIGATION_DISTANCE,
    lodLevel: 3,
    direction: [1, 0.72, 1],
  },
  {
    id: 'local-group',
    label: 'Groupe local',
    description: 'Relier les galaxies voisines',
    targetId: 'local-group',
    distance: 17_000,
    lodLevel: 4,
    direction: [1, 0.72, 1],
  },
  {
    id: 'nearby-universe',
    label: 'Univers proche',
    description: 'Explorer le volume local et l’amas de la Vierge',
    targetId: 'nearby-universe',
    distance: 120_000,
    lodLevel: 5,
    direction: [1, 0.55, 1],
  },
  {
    id: 'cosmic-web',
    label: 'Réseau cosmique',
    description: 'Parcourir les groupes de galaxies de Cosmicflows-4',
    targetId: 'cosmic-web',
    distance: 420_000,
    lodLevel: 6,
    direction: [1, 0.48, 1],
  },
];

export function getNavigationScale(id: NavigationScaleId): NavigationScaleDefinition {
  const scale = NAVIGATION_SCALES.find((candidate) => candidate.id === id);

  if (!scale) {
    throw new Error(`Échelle de navigation inconnue : ${id}.`);
  }

  return scale;
}

export function getNavigationScaleForLod(lodLevel: number): NavigationScaleDefinition {
  const normalizedLevel = Math.max(0, Math.min(NAVIGATION_SCALES.length - 1, lodLevel));

  return NAVIGATION_SCALES[normalizedLevel] ?? NAVIGATION_SCALES[0]!;
}
