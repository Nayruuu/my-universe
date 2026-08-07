---
title: Performances et limites
description: Comprenez les profils graphiques, le streaming, les lots GPU, les prérequis navigateur, les métriques et les limites d’Universe Map.
---

# Performances et limites

Universe Map vise 60 images par seconde sur un ordinateur récent et 30 sur mobile. Un temps d’image
stable compte davantage que l’affichage simultané de tous les points disponibles.

## Maîtrise du rendu

- étoiles, hôtes d’exoplanètes, groupes et grandes structures utilisent des lots de points ou lignes GPU ;
- aucun objet Three.js individuel n’est créé pour chaque entrée d’un grand catalogue ;
- les index spatiaux chargent uniquement les tuiles pertinentes pour la caméra ;
- textures et matériaux détaillés arrivent près de leur niveau de détail utile ;
- les calculs orbitaux sont moins fréquents et interpolés ;
- les budgets de labels dépendent de l’échelle, de la qualité et des collisions ;
- les effets volumétriques adaptent échantillonnage et pixels à la qualité ;
- la boucle de rendu s’exécute hors de la détection de changements Angular.

## Profils graphiques

| Profil | Usage                                             | Réductions typiques                                                |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------ |
| Faible | Téléphones, anciens portables, économie d’énergie | Moins de points, petites textures, volumes courts et peu de tuiles |
| Moyen  | GPU intégrés et usage général                     | Densité et post-traitement équilibrés                              |
| Élevé  | Ordinateurs récents                               | Catalogues, textures, volumes et détails plus riches               |

Le profil ne modifie jamais les coordonnées scientifiques.

## Panneau de debug

Ajoutez `?debug=true` à l’URL pour afficher FPS, draw calls, triangles, géométries, textures, objets
visibles, référentiel, distance caméra, cible, jour julien et qualité. Lors du chargement Tempel à
l’échelle du réseau cosmique, le panneau distingue aussi téléchargement, décodage et aller-retour
Worker, préparation des géométries, installation dans la scène, première image visible et durée
totale. Les données Tempel commencent à être préchargées dans la vue Univers proche sans ajouter de
géométrie à la scène. Le panneau indique si l’activation du Réseau cosmique a réutilisé ce
préchargement, son avance, puis la latence restante entre activation et visibilité.

```text
https://super-universe.app/fr/?debug=true
```

## Prérequis et limites connues

JavaScript, WebGL 2, une mémoire GPU adaptée et les événements pointeur sont nécessaires. En cas
d’avertissement, baissez la qualité plutôt que le zoom du navigateur.

La carte n’est pas exhaustive ; rayons et transitions sont parfois adaptés ; le mode observable
n’intègre pas encore tout le temps de trajet lumineux ; les relevés cosmologiques ont des couvertures
différentes ; l’absence de détection ne prouve pas un vide physique ; les surfaces détaillées, la
météo en direct et un lancer relativiste exact restent hors périmètre.

Si la navigation ralentit, passez en qualité faible, fermez les autres onglets utilisant le GPU et
revenez vers une cible connue. Pour une donnée statique absente, inspectez le fichier concerné dans le
panneau réseau plutôt que de conclure que toute la carte est indisponible.

Suite : [Guide développeur](/fr/developers/).
