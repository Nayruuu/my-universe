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

La cible définit le pivot de caméra ; la sélection définit la fiche affichée. Elles coïncident après
une recherche ou un clic sur un nom, mais peuvent différer pendant une navigation libre.

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
