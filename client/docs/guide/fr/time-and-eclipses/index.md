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

**Lumière reçue** considère la date choisie comme la date de réception. Les corps compatibles du
Système solaire sont vus depuis la Terre et les étoiles HYG depuis le barycentre du Système solaire.
Chaque objet compatible est calculé à sa propre date d’émission ; la rotation axiale d’un corps est
évaluée à cette même date. La fiche affiche le temps de trajet lumineux calculé et la date d’émission.

Le mode couvre actuellement le Soleil, la Lune, les planètes, les lunes galiléennes, les satellites à
deux corps documentés, les planètes naines, astéroïdes, comètes, étoiles HYG et systèmes
exoplanétaires dont la distance hôte est publiée. Les corps fournis par Astronomy Engine conservent
une confiance calculée. Pour les autres objets du Système solaire, le retard reçu depuis la Terre est
résolu itérativement avec les mêmes éléments moyens ou osculateurs JPL que la carte ; le résultat
reste donc explicitement extrapolé. L’amplification visuelle des distances n’intervient jamais dans
ce calcul.

Pour un système exoplanétaire, la
[distance système NASA PSCompPars](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
détermine un retard barycentrique commun à l’étoile hôte et à toutes ses planètes, selon la
[définition UAI du parsec](https://www.iau.org/static/resolutions/IAU2015_French.pdf). La direction
statique de l’hôte ne change pas, car cette couche ne reconstruit pas son mouvement propre. Chaque
orbite planétaire locale est évaluée à cette date d’émission commune, mais sa phase, son orientation
et son échelle d’affichage restent explicitement illustratives et non une éphéméride observée. Les
systèmes sans distance publiée restent simultanés. Galaxies et grandes structures conservent aussi
leur état simultané jusqu’à la définition d’un contrat cosmologique.

Il s’agit d’un modèle à vitesse finie de la lumière, pas d’un modèle d’observation relativiste ou
cosmologique complet. L’extrapolation du mouvement uniforme HYG est bornée à ±10 000 années juliennes
et cette borne est signalée lorsqu’elle est atteinte.

Le planétarium d’observation terrestre reste une projection topocentrique distincte. Il emploie le
lieu choisi pour l’altitude, l’azimut, le masquage par le relief et la taille angulaire apparente ;
sélectionner Lumière reçue ne transforme pas la carte 3D en ce planétarium.

## Positions et rotations

Les positions de la Lune, des planètes et des lunes galiléennes sont calculées localement avec
Astronomy Engine. Les autres petits corps et satellites sélectionnés emploient les éléments
documentés du [JPL SBDB](https://ssd-api.jpl.nasa.gov/doc/sbdb.html) ou les
[éléments moyens des satellites JPL](https://ssd.jpl.nasa.gov/sats/elem/) dans un fournisseur à deux
corps simplifié. La fiche indique le niveau de fiabilité correspondant.

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
