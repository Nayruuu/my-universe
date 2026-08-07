---
title: Feuille de route
description: Découvrez ce qu’Universe Map a déjà livré, les améliorations prioritaires et les travaux scientifiques ou de performance volontairement différés.
---

# Feuille de route

_Dernière révision : 27 août 2026._

Cette page est la feuille de route publique de référence d’Universe Map. Elle décrit des résultats et
des critères de validation plutôt que de promettre des dates. La justesse scientifique, une navigation
lisible, un temps d’image stable et une architecture entièrement statique dans le navigateur restent
des contraintes pour chaque évolution.

## Lire la feuille de route

| État    | Signification                                                      |
| ------- | ------------------------------------------------------------------ |
| Livré   | Disponible dans l’application actuelle et couvert par des tests    |
| Actuel  | Prochaines améliorations de l’expérience existante                 |
| Ensuite | Travail nécessitant d’abord un contrat scientifique ou des mesures |
| Différé | Utile seulement avec de nouvelles données, sources ou observations |

## Livré

- Le **planétarium d’observation terrestre** propose un ciel HYG de 10 000 étoiles librement
  orientable, les constellations modernes, altitude et azimut, un champ de vision de 102° à 2° ancré
  au pointeur, 461 lieux restaurables depuis l’URL, une géolocalisation consentie arrondie à trois
  décimales et des contextes de scène locaux illustratifs.
- Chaque lieu fixe du catalogue dispose d’un profil d’obstruction à 360° calculé depuis le produit
  de relief de surface NOAA/NCEI ETOPO 2022 v1 à 60 secondes d’arc. Ces profils compacts sont chargés
  à la demande et peuvent masquer étoiles, Lune et planètes derrière le relief modélisé ; bâtiments,
  végétation, microrelief et coordonnées libres restent explicitement hors de ce modèle. Trois
  enveloppes de distance calculées (0–30, 30–100 et 100–300 km) donnent sa profondeur à la silhouette ;
  couleurs et éclairage restent stylistiques.
- La Lune et les sept planètes visibles réutilisent dans cette vue leurs objets Three.js, matériaux,
  éclairages et textures différées existants. Directions topocentriques et diamètres angulaires sont
  calculés ; le plancher de lisibilité borné reste explicitement illustratif.
- Les étoiles et la Voie lactée gagnent désormais du détail de façon continue au zoom au lieu de
  conserver une taille de pixel figée. La navigation élimine aussi les cibles et sélections devenues
  hors contexte visuel.
- Les vitesses cartésiennes J2000 de HYG propagent désormais dans le temps le catalogue partagé, le
  ciel observable et les figures de constellation, avec confiance extrapolée explicite et borne de
  validité à ±10 000 années juliennes.
- Le mode temporel **Lumière reçue** considère désormais la date choisie comme date de réception. Il
  antidate le Soleil, la Lune et les planètes depuis la Terre avec Astronomy Engine, et résout une
  date retardée propre à chaque étoile HYG depuis le barycentre du Système solaire. Les rotations
  axiales compatibles emploient cette date d’émission, les fiches exposent retard et date d’émission,
  et le modèle HYG conserve sa borne explicite de ±10 000 années juliennes.
- Les lunes galiléennes utilisent désormais Astronomy Engine à leur date reçue depuis la Terre. Les
  autres satellites, planètes naines, astéroïdes et comètes documentés résolvent itérativement le
  temps de trajet géométrique avec leurs éléments JPL à deux corps existants ; leur confiance reste
  extrapolée et l’amplification visuelle des distances reste hors du calcul scientifique.
- Les systèmes exoplanétaires documentés partagent désormais un retard barycentrique dérivé de la
  distance hôte publiée par la NASA. La direction statique de l’hôte ne change pas et chaque orbite
  planétaire locale est évaluée à cette date d’émission, tandis que sa phase reste explicitement
  illustrative ; les systèmes sans distance publiée restent simultanés.
- Murs publiés, bassins probabilistes, attracteurs et répulseurs conservent une provenance et une
  sémantique visuelle séparées au lieu d’être fusionnés avec les filaments Tempel.
- Le démarrage à froid, la transition Tempel, la stabilité des ressources et celle des images
  disposent de benchmarks navigateur reproductibles.

## Priorités actuelles

- Définir des contrats de lumière reçue adaptés aux galaxies et aux grandes structures. Elles
  demandent une sémantique cosmologique de temps de regard en arrière et de décalage spectral plutôt
  qu’une simple distance divisée par la vitesse de la lumière.

Le planétarium reste une projection topocentrique distincte du lieu choisi. La carte temporelle
Lumière reçue emploie la Terre pour les corps compatibles du Système solaire et le barycentre du
Système solaire pour les étoiles HYG et les systèmes exoplanétaires documentés.

## Prochains investissements mesurés

- Exécuter les benchmarks Tempel, démarrage, mémoire et fréquence d’image sur des appareils physiques
  représentatifs des gammes faible, moyenne et élevée. Précompilation des shaders ou fallbacks plus
  lourds ne seront ajoutés que si ces mesures en justifient le coût.

## Volontairement différé

- La hiérarchie agrégée d’étoiles préparée reste dormante jusqu’à ce qu’un catalogue plus dense exige
  une représentation inter-échelles visible. Toute activation devra déplacer sa préparation dans un
  Web Worker et éviter les coûts réseau ou GPU invisibles.
- De nouvelles silhouettes ou maillages de corps irréguliers ne seront ajoutés que lorsqu’un modèle
  de forme faisant autorité justifiera téléchargement, décodage, attribution et coût de rendu.

## Limites du produit

Cette feuille de route ne promet ni Univers exhaustif, ni météo en direct, ni exploration du sol, ni
simulation gravitationnelle complète, ni lancer relativiste. Consultez
[Fiabilité scientifique](/fr/scientific-confidence/) et
[Performances et limites](/fr/performance-and-limits/) pour le contrat actuel.

Suite : [À propos du projet](/fr/about/).
