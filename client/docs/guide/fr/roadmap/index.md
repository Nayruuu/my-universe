---
title: Feuille de route
description: Découvrez ce qu’Universe Map a déjà livré, les améliorations prioritaires et les travaux scientifiques ou de performance volontairement différés.
---

# Feuille de route

_Dernière révision : 3 septembre 2026._

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
- Un planificateur local à la demande classe la Lune, les planètes et les satellites catalogués
  visibles par altitude et évalue les 48 étoiles les plus brillantes du catalogue pour en proposer
  jusqu’à huit visibles. Choisir une suggestion ouvre sa fiche existante et recentre le ciel.
  L’horizon calculé et le relief sont pris en compte quand ils sont disponibles. La cible active a
  désormais une courbe d’altitude calculée sur 24 heures avec lever, culmination, coucher, bandes de
  crépuscule USNO, gêne lunaire, indice de meilleure fenêtre explicitement illustratif et action qui
  déplace ensemble le temps partagé et la caméra. La cible de cette courbe peut être remplacée depuis
  le même catalogue local sans déplacer le ciel courant ; seule cette action engage la cible, le temps
  partagé et la caméra. Une comparaison compacte applique le même calcul à sept nuits consécutives.
  Elle met automatiquement en avant la meilleure avec un indice illustratif comparable sur 100 et
  expose hauteur, obscurité, gêne lunaire et dégagement du relief avant son action directe vers le
  meilleur instant, raffiné localement à cinq minutes. Météo en direct, pollution lumineuse et
  obstacles locaux non mesurés restent hors du modèle.
- Chaque lieu fixe du catalogue dispose d’un profil d’obstruction à 360° calculé depuis le produit
  de relief de surface NOAA/NCEI ETOPO 2022 v1 à 60 secondes d’arc. Ces profils compacts sont chargés
  à la demande et peuvent masquer étoiles, Lune, planètes et satellites derrière le relief modélisé ; bâtiments,
  végétation, microrelief et coordonnées libres restent explicitement hors de ce modèle. Trois
  enveloppes de distance calculées (0–30, 30–100 et 100–300 km) donnent sa profondeur à la silhouette ;
  couleurs et éclairage restent stylistiques.
- La Lune, les sept planètes visibles et les vingt autres satellites catalogués réutilisent dans cette
  vue leurs objets Three.js, matériaux, éclairages et textures différées. Directions topocentriques et
  diamètres angulaires emploient les distances orbitales physiques : les positions galiléennes sont
  calculées et les seize trajectoires fondées sur des éléments moyens J2000 restent signalées comme
  extrapolées. Les satellites apparaissent à partir d’un champ de 12°, ou immédiatement lorsqu’ils
  sont ciblés, afin d’éviter les superpositions au grand angle ; le plancher de lisibilité reste
  explicitement illustratif.
- Les étoiles et la Voie lactée gagnent désormais du détail de façon continue au zoom au lieu de
  conserver une taille de pixel figée. La navigation élimine aussi les cibles et sélections devenues
  hors contexte visuel. Lors de l’entrée dans la Galaxie, le pivot de caméra progresse continûment du
  centre galactique jusqu’au Soleil tandis que le volume externe, le catalogue stellaire et la bande
  panoramique locale se fondent sans coupure de référentiel. Cette trajectoire réversible commence
  dès l’Univers proche, sans lancer de recentrage de caméra aux changements hiérarchiques. Le volume Gaia reste compact pendant
  toute l’approche extérieure, puis ne se déploie dans sa projection lisible qu’une fois la caméra
  entrée dans le disque ; la luminosité galactique reste en outre bornée quel que soit l’angle de vue.
- La calibration structurelle de la Voie lactée sépare désormais son métrique physique et ses
  coordonnées canoniques de son enveloppe lumineuse explicitement illustrative. À l’entrée
  galactique, cette enveloppe atteint quatre fois le diamètre canonique et grandit sur toute l’approche
  logarithmique, sans modifier les distances de caméra, la réponse de la molette, le picking ni le
  placement des catalogues. Pour rendre la traversée perceptible sans ralentir la caméra, le même nuage
  de points groupé comprend 140 000 traceurs déterministes et illustratifs : 28 000 restent répartis
  dans le disque épais galactocentrique, 56 000 forment une enveloppe d’entrée courbe et symétrique
  autour de l’axe galactique, et 56 000 composent un cœur de passage rapproché plus étroit. Chaque
  niveau de qualité couvre tout le rayon et tous les azimuts de ce cœur, ce qui évite les portions
  vides sur le trajet. Toutes les positions restent fixes ; seuls les sprites les plus proches
  s’étirent brièvement lorsque la distance de caméra varie, puis redeviennent ronds à l’arrêt. Leur
  défilement apparent est le repère de perspective produit pendant que la caméra traverse le
  référentiel galactique illustratif, mis à l’échelle continûment. Pendant cette
  traversée, le voile volumétrique et les particules morphologiques diffuses s’effacent désormais avant
  les traceurs lointains : il reste des étoiles de proximité plus rares et plus nettes, plutôt qu’un
  grain poussiéreux uniforme. Les noms des galaxies du Groupe local s’effacent avant la traversée dense,
  tandis que la cible active reste lisible. Les traceurs ne représentent pas des étoiles individuelles
  cataloguées. Le blanc du volume est désormais explicitement traité comme la lumière intégrée,
  illustrative, d’étoiles non résolues, et non comme de la poussière : son socle inter-bras continu est
  réduit, tandis que bras, filaments et amas conservent des éclats séparés par des intervalles noirs.
  La passe colorimétrique suivante sépare maintenant la lumière intégrée ivoire chaud, les jeunes
  étoiles saphir, le cœur ambré, de rares accents H II magenta et la poussière presque noire. Un socle
  retenu d’étoiles ponctuelles saphir, ivoire, ambre et rouges comble aussi le raccord entre 1 400 et
  2 800 unités sans rétablir de voile diffus poussiéreux. Cette population reste explicitement
  procédurale et décorative, et non un ensemble de sources cataloguées individuellement. Une passe de
  luminance pondérée par la profondeur relève maintenant le cœur des étoiles ponctuelles, plus
  fortement pour les traceurs de passage rapproché, sans éclaircir le voile volumétrique ni le noir
  entre les étoiles.
- Une hiérarchie Gaia DR3 transforme 2 923 790 sources filtrées par qualité en agrégats calculés
  distants de 512 pc et en 133 526 échantillons de sources mesurées pour l’aperçu du voisinage
  stellaire. Chaque feuille raffinée de 512 pc conserve ses 32 sources les plus brillantes puis une
  sélection uniforme déterministe, jusqu’à 96 points. Le raffinement borné par le champ visible et
  la qualité ne charge que les branches utiles, les valide dans des Workers module, transfère leurs
  tableaux typés sans copie et ne crée jamais un objet Three.js par source. Recherche exacte, noms,
  sélection et focus restent fondés sur HYG ; les échantillons Gaia sont explicitement anonymes et
  incomplets. Au dézoom, les échantillons détaillés fondent vers les racines calculées, qui restent
  discrètement visibles jusqu’au Groupe local tandis que le volume local se contracte selon une
  courbe logarithmique pour se fondre dans le disque de la Voie lactée.
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
- Les galaxies proches utilisent désormais le temps de trajet géométrique de leur distance de
  catalogue. Les modules de distance Cosmicflows-4 sont traités comme distances de luminosité et les
  distances cartographiques des grandes structures comme distances comobiles ; les deux sont
  inversées dans le modèle ΛCDM plat documenté. Les fiches exposent redshift inféré et temps de regard
  en arrière, tandis que positions et apparences statiques restent inchangées et que le résultat est
  marqué extrapolé.
- Murs publiés, bassins probabilistes, attracteurs et répulseurs conservent une provenance et une
  sémantique visuelle séparées au lieu d’être fusionnés avec les filaments Tempel.
- Le démarrage à froid, la transition Tempel, la stabilité des ressources et celle des images
  disposent de benchmarks navigateur reproductibles.
- Une baseline physique haut de gamme répétée documente désormais trois passages pour le démarrage,
  Tempel et les images à froid, puis trois cycles de ressources après préchauffage sur un Apple M5 Max
  utilisant son véritable renderer Metal. Elle ne constitue pas une preuve pour une autre classe
  d’appareil.
- Un benchmark dédié au planétarium observable couvre désormais la rotation réelle du ciel, le
  recentrage, la transition ancrée sur Jupiter vers la planète résolue partagée, puis le dézoom. Trois
  passages physiques Retina haut de gamme ont réussi à la borne DPR 1,5 de la qualité élevée, sans
  aucune image longue. Une matrice séparée de stress CPU 4×/6×, explicitement simulée, réussit aussi
  et mesure uniquement la marge de régression.
- Les cinq protocoles manuels de performance partagent désormais un rapport de preuve JSON versionné
  qui conserve l’état de la source, l’hôte, le renderer, la configuration, les échantillons et la
  synthèse. Un garde-fou physique refuse les mesures simulées, rendues par logiciel ou non classées
  avant d’écrire le rapport. Un lanceur exigeant un checkout propre les exécute séquentiellement et
  lie les cinq fichiers dans un manifeste vérifiable par SHA-256.
- Une commande séparée sur checkout propre exécute désormais la campagne de régression moyenne et
  faible sur le même hôte pour les cinq protocoles : qualité moyenne à CPU 4×, puis qualité faible à
  CPU 6×. Son manifeste simulé distinct lie dix rapports et précise que GPU, mémoire, pilote, bande
  passante et comportement thermique restent ceux de l’hôte source.
- Les quatre catalogues complémentaires sont désormais téléchargés et décodés dans un Worker module
  dédié, puis leurs buffers typés sont transférés sans copie. Cette préparation ne crée aucune
  ressource de scène ; une fois terminée, l’installation sur le thread principal des registres, de la
  recherche, des géométries et du GPU exige une nouvelle fenêtre de caméra stable de 1,2 seconde.
  Toute transition remet ce délai à zéro, le mode observable suspend entièrement l’installation de
  fond et une cible demandée explicitement reste chargée immédiatement. La campagne propre au niveau
  de la révision réussit désormais ses dix rapports. Les passages d’échelle moyenne/CPU 4× restent à
  9,3 ms au p95 avec une pire image à 66,5 ms ; les passages faible/CPU 6× restent à 16,6–16,7 ms au
  p95 avec une pire image à 83,4 ms. Les passages observables résolvent Jupiter 3/3 dans les deux
  profils et les nombres de ressources ne dérivent pas.

## Priorités actuelles

- Finaliser la calibration visuelle de la Voie lactée face au passage vidéo de référence. Les passes
  de clarté intérieure, de séparation de la lumière intégrée, de palette colorimétrique et de raccord
  stellaire étant en place, la prochaine ajustera le contraste structurel des bandes de poussière et
  du cœur avant de vérifier les trois profils de qualité et les benchmarks de rendu. Les distances
  physiques canoniques resteront inchangées.
- Conserver le manifeste simulé propre réussi à 10/10 comme baseline de régression et relancer la
  campagne après toute évolution importante du rendu ou des catalogues. Les preuves actuelles ne
  justifient ni une précompilation de shaders plus lourde ni un fallback plus dégradé ; une validation
  physique moyenne/faible reste facultative si du matériel adapté devient disponible. Les profils
  simulés restent des gardes de régression, pas des revendications matérielles.

Le planétarium reste une projection topocentrique distincte du lieu choisi. La carte temporelle
Lumière reçue emploie la Terre pour les corps compatibles du Système solaire et le barycentre du
Système solaire pour les étoiles HYG et les systèmes exoplanétaires documentés.

## Volontairement différé

- De nouvelles silhouettes ou maillages de corps irréguliers ne seront ajoutés que lorsqu’un modèle
  de forme faisant autorité justifiera téléchargement, décodage, attribution et coût de rendu.

## Limites du produit

Cette feuille de route ne promet ni Univers exhaustif, ni météo en direct, ni exploration du sol, ni
simulation gravitationnelle complète, ni lancer relativiste. Consultez
[Fiabilité scientifique](/fr/scientific-confidence/) et
[Performances et limites](/fr/performance-and-limits/) pour le contrat actuel.

Suite : [À propos du projet](/fr/about/).
