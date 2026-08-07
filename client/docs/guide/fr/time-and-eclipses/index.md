---
title: Temps et éclipses
description: Comprenez le temps UTC, les vitesses, les éphémérides planétaires, la rotation axiale et les éclipses dans Universe Map.
---

# Temps et éclipses

La timeline contrôle en interne un jour julien numérique. L’interface accepte une date civile UTC et
la convertit avant de transmettre le temps au moteur de rendu.

## Contrôles temporels

Vous pouvez saisir une date UTC, lire ou mettre en pause, revenir au présent, sélectionner une vitesse
adaptée à l’échelle et parcourir les éclipses passées ou futures documentées. En pause, les positions
orbitales et la rotation axiale restent fixes. À la reprise, elles dérivent du même temps interne et
non du nombre d’images rendues.

## Modes temporels

**État à la date choisie** montre l’état estimé des objets au même instant. C’est le mode principal
implémenté.

**Vue observable** est réservé à une représentation tenant compte du temps de trajet de la lumière
depuis un observateur. L’architecture distingue ce mode, mais le prototype ne fournit pas encore un
modèle relativiste complet à toutes les échelles.

## Positions et rotations

Les positions de la Lune et des planètes sont calculées localement avec Astronomy Engine. Certains
petits corps et satellites emploient des éléments orbitaux documentés ou des fournisseurs simplifiés.
La fiche indique le niveau de fiabilité correspondant.

Les corps pris en charge utilisent une orientation axiale dépendante de la date, y compris les
rotations rétrogrades. L’alignement des textures et la taille visible restent des adaptations de
rendu, pas des produits de navigation de surface.

## Navigateur d’éclipses

Le navigateur couvre les familles d’éclipses solaires et lunaires liées au système Terre–Lune. Il
peut placer la simulation sur un événement, centrer les corps concernés et calculer les circonstances
locales pour une ville française prédéfinie ou des coordonnées saisies manuellement. Ces coordonnées
restent dans le navigateur et utilisent l’UTC, car aucun service de géocodage ou de fuseau horaire
n’est appelé.

Les vues solaires indiquent la classification partielle, annulaire ou totale, la géométrie
Lune–Terre–Soleil et l’ombre à l’instant sélectionné. La trajectoire optionnelle affiche une autre
carte : son enveloppe bleue cumule la visibilité partielle pendant l’événement, tandis que sa bande
corail ou ambre délimite le corridor de totalité ou d’annularité. Les contacts locaux C1 (début de la
phase partielle), C2 (début de la phase centrale), maximum, C3 (fin de la phase centrale) et C4 (fin
de la phase partielle) sont affichés, avec une mention explicite sous l’horizon. C2 et C3 n’existent
que pour une totalité ou une annularité locale. Les vues lunaires montrent l’entrée de la Lune dans
l’ombre terrestre.

::: warning Interprétation
La scène orbitale exagère certains rayons et écarts pour rester lisible. Les couches de surface sont
des reconstructions éducatives, pas des prévisions opérationnelles. Pour observer, consultez toujours
un service astronomique officiel et les consignes de protection oculaire.
:::

La signification des contacts suit les définitions des circonstances locales de
[l’IMCCE](https://promenade.imcce.fr/fr/pages3/387.html). Le calcul du 12 août 2026 est aussi vérifié
avec les [circonstances locales NASA GSFC](https://eclipse.gsfc.nasa.gov/SEcirc/SEcircEU/ParisFRA1%2B21.html)
pour Paris.

## Dates hors de la plage documentée

La précision dépend du fournisseur et de la période. Les extrapolations longues, reconstructions
historiques et temps cosmologiques sont explicitement marqués comme extrapolés, simulés ou
illustratifs.

Suite : [Fiabilité scientifique](/fr/scientific-confidence/).
