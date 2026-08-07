---
title: Questions fréquentes
description: Réponses sur les échelles, la précision, les objets absents, les éclipses, les performances, les données statiques et le périmètre d’Universe Map.
---

# Questions fréquentes

## Les tailles et distances sont-elles physiquement à l’échelle ?

Les valeurs sources conservent leurs unités scientifiques, mais le rendu adapte rayons, luminosité et
certaines distances entre échelles. Une échelle globale physique rendrait planètes et étoiles
invisibles pendant l’essentiel du voyage. La fiche indique le mode d’échelle visuelle.

## Pourquoi la représentation change-t-elle pendant le zoom ?

Les niveaux de détail transforment progressivement une galaxie distante en imposteur, disque
procédural puis volume de particules borné. Les fondus maintiennent la continuité et limitent géométrie
et draw calls.

## Pourquoi certains noms manquent-ils ?

Les labels sont classés et gérés contre les collisions. Augmentez leur densité, rapprochez-vous ou
recherchez directement l’objet. Afficher tous les noms masquerait la carte.

## Puis-je trouver chaque étoile ou galaxie connue ?

Non. La carte utilise des catalogues sélectionnés et tuilés pour valider la navigation. Toutes leurs
entrées sont recherchables, mais il ne s’agit pas d’une base astronomique exhaustive.

## Les surfaces des exoplanètes sont-elles réelles ?

Non. Période, rayon, masse, méthode de détection et position de l’hôte viennent du catalogue ; couleur,
terrain, phase, orientation et orbite rapprochée sont illustratifs.

## Puis-je préparer une observation d’éclipse avec la carte ?

Utilisez-la pour comprendre la géométrie et explorer les événements, puis confirmez les circonstances
locales et la sécurité oculaire auprès d’un service astronomique officiel.

## Le trou noir utilise-t-il la relativité générale réelle ?

Non. Une lentille qualitative déforme le fond rendu, avec horizon et émission séparés. Ce n’est pas un
lancer de rayons relativiste numérique.

## L’application a-t-elle besoin d’un backend ?

Non. Recherche, temps, catalogues, textures, tuiles et partage d’URL fonctionnent dans le navigateur
ou sont servis statiquement.

## Puis-je partager exactement une vue ?

Oui. Le bouton de partage conserve cible, sélection, date, zoom, mode temporel, qualité et principales
options d’affichage.

## Comment signaler une erreur ou contribuer ?

Ouvrez une issue dans le [dépôt GitHub](https://github.com/Nayruuu/my-universe/issues). Pour une
correction scientifique, indiquez source, référentiel, époque, unité et une valeur vérifiable.
