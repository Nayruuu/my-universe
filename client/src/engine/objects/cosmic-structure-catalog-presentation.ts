import { CosmicStructureType } from '../../data/models/universe.models';
import type {
  CosmicStructureCatalog,
  CosmicStructureCatalogSource,
} from '../loaders/cosmic-structure-catalog';

export function cosmicStructureName(
  source: CosmicStructureCatalogSource,
  identifier: string,
): string {
  return source.recordNames?.[identifier] ?? `${source.objectNamePrefix} ${identifier}`;
}

export function cosmicStructureAliases(
  source: CosmicStructureCatalogSource,
  identifier: string,
): string[] {
  return [
    ...new Set([
      identifier,
      `${source.id} ${identifier}`,
      ...(source.recordAliases?.[identifier] ?? []),
    ]),
  ];
}

export function cosmicStructureDescription(structureType: CosmicStructureType): string {
  const descriptions: Partial<Record<CosmicStructureType, string>> = {
    wall: 'Mur cosmique documenté dans la distribution des galaxies ou reconstruit à partir de leurs mouvements. Son symbole indique un repère étendu publié, sans le transformer en volume sphérique ni en filament Tempel.',
    basin:
      'Bassin d’attraction probabiliste reconstruit à partir des mouvements de galaxies. Le rayon affiché est un équivalent visuel dérivé du volume publié : il ne représente pas sa frontière réelle.',
    attractor:
      'Direction de convergence du champ de vitesses reconstruite à grande échelle. Ce repère cartographique ne représente ni un objet compact ni une frontière physique observée.',
    repeller:
      'Direction de divergence du champ de vitesses reconstruite autour d’une sous-densité cosmique. Ce repère calculé ne représente pas un objet matériel.',
    void: 'Région sous-dense identifiée dans un relevé de galaxies par une méthode statistique documentée. Son centre et son rayon dépendent du relevé, du modèle cosmologique et de l’algorithme employés.',
    filament:
      'Filament extrait de la distribution tridimensionnelle des galaxies par une méthode statistique publiée. Son symbole marque le centre catalogué et son épine publiée peut être affichée point par point ; sa largeur visuelle n’est pas physique.',
  };

  return (
    descriptions[structureType] ??
    'Structure de galaxies identifiée dans un champ de densité publié. Cette fiche représente une détection de catalogue, qui peut recouvrir des détections issues d’autres méthodes.'
  );
}

export function cosmicStructureScore(catalog: CosmicStructureCatalog, index: number): number {
  const structureType = catalog.structureTypes[index]!;
  const source = catalog.metadata.sources[catalog.sourceIndices[index]!]!;
  const typeWeight = structureType === 'supercluster' ? 1.25 : 1;
  const landmarkPriority = source.mapPriority === 'landmark' ? 1_000_000 : 0;

  return (
    landmarkPriority +
    typeWeight *
      (1 + Math.log1p(catalog.galaxyCounts[index]!)) *
      (1 + catalog.radiiMpc[index]! / 25) *
      catalog.confidences[index]!
  );
}
