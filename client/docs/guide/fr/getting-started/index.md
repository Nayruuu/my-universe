---
title: Bien démarrer
description: Ouvrez Universe Map, découvrez son interface, choisissez une qualité graphique et partagez votre première vue astronomique.
---

# Bien démarrer

Universe Map fonctionne entièrement dans un navigateur moderne. Aucun compte ni backend applicatif
n’est nécessaire. Les catalogues, textures et modèles sont des fichiers statiques chargés
progressivement lorsque la caméra change d’échelle.

## Ouvrir la carte

Rendez-vous sur [super-universe.app](https://super-universe.app/fr/). La première vue charge le moteur
de rendu et un manifeste compact ; les catalogues stellaires et galactiques plus volumineux ne sont
téléchargés qu’au moment utile.

Pour une bonne première expérience :

1. utilisez un navigateur desktop récent avec WebGL 2 ;
2. conservez la qualité **Élevée** avec un GPU récent ;
3. attendez la disparition de l’écran de chargement ;
4. faites défiler au-dessus d’un objet visible ou cliquez sur son nom.

La navigation tactile est également prise en charge et la densité visuelle diminue automatiquement
sur les petits appareils.

## Visite de l’interface

| Zone                   | Fonction                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Recherche supérieure   | Trouver planètes, lunes, étoiles, exoplanètes, galaxies, trous noirs, supernovas et grandes structures. |
| Fil d’échelle          | Afficher la hiérarchie astronomique et revenir directement vers un parent.                              |
| Fiche objet            | Consulter les sources, alias, propriétés physiques, niveau de fiabilité et actions de focus.            |
| Contrôles flottants    | Zoomer, revenir à la Terre ou au Soleil, afficher orbites, constellations et noms.                      |
| Timeline               | Modifier l’heure UTC, lire ou mettre en pause, choisir la vitesse et parcourir les éclipses.            |
| Échelle cartographique | Voir une échelle écran adaptée au contexte de caméra.                                                   |

## Un premier voyage

1. recherchez **Terre** et choisissez le résultat ;
2. utilisez la molette ou le pincement pour sortir du Système solaire ;
3. sélectionnez **Soleil**, puis continuez jusqu’au voisinage stellaire ;
4. choisissez **Voie lactée** dans le menu d’échelle ;
5. poursuivez vers le Groupe local, l’Univers proche et la toile cosmique ;
6. utilisez le fil d’Ariane pour revenir vers le Système solaire.

La cible logique définit la hiérarchie et les limites de distance, le pivot géométrique définit le
centre de rotation et la sélection définit la fiche affichée. Un centrage explicite les aligne souvent,
mais le zoom au pointeur et la navigation libre peuvent les séparer.

## Observer une étoile depuis l’horizon terrestre

Recherchez une étoile comme **Sirius**, ouvrez sa fiche puis choisissez **Localiser depuis la Terre**.
La vue du ciel local reprend la date et le lieu d’observation de la carte. Faites glisser pour regarder
autour de vous, utilisez la molette ou le pincement pour changer le champ de vision, puis
**Recentrer** pour retrouver la cible. Ce sont des commandes de planétarium : tant que la vue Horizon
est ouverte, la molette ne déclenche ni changement sémantique d’échelle ni translation à la distance
minimale. Le sélecteur propose 461 lieux d’observation statiques dans le monde ; l’observateur et la
vue planétarium sont conservés dans l’URL partagée. **Utiliser ma position** ne demande l’autorisation
du navigateur qu’après sélection, arrondit les coordonnées obtenues à trois décimales (environ 100 m)
puis emploie le même contrat d’observateur partageable.

La Lune et les planètes visibles réutilisent les mêmes objets Three.js, matériaux, éclairages et
textures sourcées ou adaptées que la carte. Leurs directions topocentriques et diamètres angulaires
sont calculés pour le lieu et l’instant choisis. Une taille minimale bornée garde les petites planètes
lisibles et reste explicitement illustrative, sans prétendre représenter leur taille angulaire réelle.

L’horizon suit l’azimut du regard et reste solidaire du sol pendant que le ciel évolue avec le temps.
Huit villes de référence disposent d’un contexte visuel composé à la main ; chaque lieu du catalogue
charge à la demande quatre repères proches depuis des paquets régionaux statiques. Les 461 lieux du
catalogue chargent aussi un profil d’obstruction compact calculé depuis le modèle d’élévation NOAA/NCEI
ETOPO 2022 à 60 secondes d’arc. Ce relief régional peut masquer étoiles, Lune et planètes. Des noms,
coordonnées ou hauteurs documentés ne transforment pas le décor urbain en relevé : bâtiments,
lumières, skyline, silhouettes génériques et plaine des coordonnées libres restent explicitement
illustratifs.

Direction, altitude, azimut, précession, nutation, réfraction atmosphérique et obstruction du relief
des lieux du catalogue sont calculés dans le navigateur ou lors de la construction reproductible des
données statiques. Le masque ETOPO décrit un relief régional dérivé d’un modèle, pas une géométrie
locale arpentée : il omet bâtiments, végétation et micro-relief. La vue ne remplace ni la météo, ni une
reconstruction historique, ni un outil professionnel de préparation d’observation.

## Qualité graphique

- **Faible** réduit particules, textures, volumes et tuiles chargées ;
- **Moyenne** équilibre détails et coût GPU ;
- **Élevée** active la représentation la plus riche autorisée à l’échelle courante.

La qualité ne modifie jamais les coordonnées ni la fiabilité scientifiques.

## Partager une vue

Le bouton de partage copie une URL qui conserve la cible, la sélection, la date, le zoom, le mode
temporel, la qualité, la densité des noms, les orbites, les constellations et les labels. L’URL est
actualisée après un court délai, pas à chaque image rendue.

Suite : [Navigation et échelles](/fr/navigation/).
