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

## État des mesures physiques

Une mesure répétée réalisée le 27 août 2026 sur un MacBook Pro haut de gamme avec Apple M5 Max,
macOS 26.6, Chrome 151, le véritable renderer Metal, le profil desktop/élevé et un ratio de pixels de
1 a donné une médiane de 259,3 ms pour la première carte utilisable et de 7,1 ms pour la première
image visible de Tempel, sur trois passages. Trois traversées froides sont restées entre 9,1 et 9,2 ms
au p95, à 16,7 ms au p99, entre 66,6 et 75 ms au maximum et entre 0,24 et 0,36 % d’images longues.
Après trois préchauffages, trois cycles sont restés à 100 géométries, 18 textures et 44 draw calls,
avec une baisse de 0,77 Mio du heap collecté.

Un profil distinct du planétarium observable a demandé un DPR navigateur de 2 sur 1 440 × 900 pixels
CSS. Le renderer en qualité élevée a appliqué sa borne documentée à 1,5 et y est resté stable sur les
trois passages. Chacun a échantillonné 1 452 à 1 455 images à 9,1 ms au p95, 9,3 ms au p99,
9,4 à 9,5 ms au maximum et sans aucune image longue ; Jupiter a atteint sa représentation résolue
dans les trois passages.

Une matrice de stress sur la même machine, explicitement simulée, est aussi restée dans le budget.
En qualité moyenne avec le CPU Chrome ralenti 4×, le canvas a utilisé un DPR de 1,25 et mesuré une
médiane de 9,3 ms au p95, 16,7 ms au p99, 24,9 ms au maximum, sans image longue. En qualité faible à
CPU 6× et DPR 1, les médianes ont atteint 15,9 ms au p95, 25,1 ms au p99 et 42 ms au maximum, avec
une pire image à 49,9 ms et 0,20 à 0,34 % d’images longues. Jupiter s’est résolue dans les six
passages sous stress. Le GPU restait le M5 Max : ces résultats mesurent une marge de régression, pas
des machines physiques représentatives des gammes moyenne ou faible.

Les cinq benchmarks de performance — démarrage, Tempel, ressources, images inter-échelles et
planétarium observable — peuvent écrire le même rapport de preuve JSON versionné avec
`UNIVERSE_BENCHMARK_REPORT_PATH`. Il conserve la révision Git et l’état dirty, les caractéristiques
de l’hôte, le navigateur et le renderer WebGL, la configuration, les échantillons et la synthèse.
`UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL=1` refuse le ralentissement CPU, un renderer logiciel ou
l’absence de `UNIVERSE_BENCHMARK_DEVICE_CLASS` déclarée avant d’écrire le rapport : une simulation
ne peut donc pas entrer silencieusement dans la matrice physique.

`npm run benchmark:campaign` exécute les cinq protocoles séquentiellement sur une machine physique
représentative. Il exige un checkout Git propre ainsi qu’une classe et un libellé déclarés, désactive
le ralentissement CPU, impose les budgets stricts et au moins trois répétitions, puis choisit par
défaut la qualité correspondant à la classe. Il écrit cinq rapports hors du dépôt et un manifeste
`universe-map/performance-campaign@1` qui les lie par des empreintes SHA-256. La commande conditionne
des preuves comparables ; elle ne transforme pas une machine en une autre classe.

`npm run benchmark:campaign:simulated` fournit une campagne de stress séparée sur le même hôte quand
aucun matériel représentatif n’est disponible. Le ralentissement CPU de Chrome s’applique aux cinq
protocoles : qualité moyenne à 4× avec un DPR observateur de 1,25, puis qualité faible à 6× avec un
DPR de 1. Les dix benchmarks restent séquentiels et produisent, depuis un checkout propre, un
manifeste `universe-map/simulated-performance-campaign@1` avec empreintes SHA-256 et limites
explicites. GPU, mémoire graphique, pilote, bande passante mémoire et comportement thermique restent
ceux de l’hôte ; moyenne et faible sont des proxys de régression, jamais des preuves matérielles.

La baseline physique répétée documente toujours uniquement la classe haut de gamme. Les mesures
physiques moyenne et faible deviennent une vérification future facultative plutôt qu’un blocage si le
matériel n’est pas disponible.

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

La carte n’est pas exhaustive ; rayons et transitions sont parfois adaptés ; Lumière reçue corrige les
objets compatibles du Système solaire — lunes galiléennes, satellites simplifiés, planètes naines,
astéroïdes et comètes compris — ainsi que les étoiles HYG du temps de trajet lumineux ; les systèmes
exoplanétaires documentés partagent un retard dérivé de la distance publiée de l’hôte, mais leurs
phases planétaires locales restent illustratives et les systèmes sans distance restent simultanés ;
les galaxies proches utilisent le temps géométrique de leur distance de catalogue ; les distances de
luminosité Cosmicflows-4 et comobiles des grandes structures utilisent un redshift inféré et le temps
de regard en arrière du modèle ΛCDM plat ; leurs positions, formes et mesures restent statiques et ne
sont pas reconstruites à la date d’émission ; les relevés cosmologiques ont des couvertures
différentes ; l’absence de détection ne prouve pas un vide
physique ; les surfaces détaillées, la météo en direct et un lancer relativiste exact restent hors
périmètre.

Si la navigation ralentit, passez en qualité faible, fermez les autres onglets utilisant le GPU et
revenez vers une cible connue. Pour une donnée statique absente, inspectez le fichier concerné dans le
panneau réseau plutôt que de conclure que toute la carte est indisponible.

Suite : [Guide développeur](/fr/developers/).
