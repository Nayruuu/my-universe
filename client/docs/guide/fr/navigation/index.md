---
title: Navigation et échelles
description: Découvrez les contrôles de caméra, le zoom sémantique, les référentiels, les cibles et les transitions d’échelle d’Universe Map.
---

# Navigation et échelles

Universe Map se comporte comme une carte spatiale, pas comme un schéma orbital fixe. Vitesse de
caméra, distance minimale, labels, représentations et arrière-plans s’adaptent au contexte
astronomique courant.

## Contrôles

| Action                     | Ordinateur                          | Tactile                          |
| -------------------------- | ----------------------------------- | -------------------------------- |
| Tourner autour de la cible | Clic gauche et glisser              | Glisser avec un doigt            |
| Translation                | Clic droit et glisser               | Glisser avec deux doigts         |
| Zoomer vers le pointeur    | Molette                             | Pincement                        |
| Sélectionner               | Cliquer sur l’objet ou son nom      | Toucher l’objet ou son nom       |
| Centrer                    | Double-clic, clic sur un nom ou `F` | Double appui ou appui sur un nom |
| Lire ou arrêter le temps   | `Espace`                            | Bouton de la timeline            |
| Changer la vitesse         | `+` ou `-`                          | Sélecteur de la timeline         |
| Fermer la fiche            | `Échap`                             | Bouton de fermeture              |

Le zoom à la molette suit le pointeur à l’écran. Lorsqu’un geste vers l’intérieur commence sur le nom
ou la représentation d’un objet navigable, cet objet est verrouillé pour toute la rafale et devient à
la fois la cible de navigation et l’ancre du zoom. L’approche reste continue et s’arrête devant sa
distance minimale ; les crans supplémentaires de la même rafale ne peuvent pas le traverser. Un
changement automatique d’échelle peut toujours remplacer la cible par le parent ou l’enfant logique
imposé par la hiérarchie. Dans l’espace vide, le pivot géométrique suit le pointeur. Depuis une cible
atteinte, la molette ne la libère que lorsque le pointeur ne la vise plus ; caméra et pivot peuvent
alors avancer à distance constante sans fermer la fiche sélectionnée. Inverser la molette rembobine
ce trajet libre avant que le dézoom reprenne.

## Les sept échelles

| Échelle             | Contenu typique                                  | Représentation principale                         |
| ------------------- | ------------------------------------------------ | ------------------------------------------------- |
| Planétaire          | Surface, atmosphère, anneaux, lunes              | Maillages et textures détaillés                   |
| Système solaire     | Soleil, planètes, petits corps, orbites          | Maillages adaptatifs, labels et trajectoires      |
| Voisinage stellaire | Étoiles HYG, hôtes d’exoplanètes, constellations | Lots de points GPU et détails de sélection        |
| Voie lactée         | Disque, bulbe, bras et position locale           | Volume émissif stratifié et contexte de catalogue |
| Groupe local        | Voie lactée, Andromède et satellites             | Imposteurs galactiques et volumes bornés          |
| Univers proche      | Galaxies et groupes du volume local              | Tuiles spatiales et lots d’ensemble               |
| Toile cosmique      | Groupes, amas, vides et filaments                | Points, lignes et volume de densité simulé        |

La transition est continue, mais chaque échelle utilise son propre référentiel. Le moteur recentre les
coordonnées autour de la caméra pour préserver la précision numérique.

## Cible, sélection et noms

- la **cible logique** pilote le trajet sémantique et les limites de distance du contexte ;
- le **pivot géométrique** est le point autour duquel tourne la caméra et suit le zoom au pointeur ;
- la **sélection** est l’objet de la fiche d’information ;
- un **label** est une annotation écran reliée à un objet et gérée contre les collisions.

Un clic sur un label sélectionne et centre son objet. La densité peut être minimale, équilibrée ou
dense. La cible, la sélection et les repères importants restent prioritaires. Le Soleil persiste aux
échelles stellaires locales, puis la Voie lactée devient le repère parent. Ces labels ne passent pas
devant une géométrie opaque plus proche.

## Navigation directe et vue vide

Le menu du fil d’échelle permet d’atteindre directement chaque niveau avec la même interpolation que
la recherche. Si une vue paraît vide, vérifiez l’échelle, activez les labels, choisissez une densité
équilibrée ou dense, ciblez le Soleil ou la Voie lactée, ou réduisez la qualité si l’appareil ralentit.

Suite : [Temps et éclipses](/fr/time-and-eclipses/).
