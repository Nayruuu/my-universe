---
title: Feuille de route
description: Découvrez ce qu’Universe Map a déjà livré, les améliorations prioritaires et les travaux scientifiques ou de performance volontairement différés.
---

# Feuille de route

_Dernière révision : 10 septembre 2026._

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
- Le retour du planétarium à la carte 3D recule progressivement depuis l’observateur pendant
  2,4 secondes : l’horizon s’efface et la Terre devient le pivot, sur le même rendu. Ce trajet
  illustratif conserve le regard au départ, s’interrompt au premier geste et respecte la préférence
  de réduction des animations. La navigation habituelle de la carte reste inchangée.
- Les fiches, la recherche, le planificateur et la timeline s’adaptent aux écrans étroits et aux
  paysages peu hauts. Les fiches proposent résumé, aperçu et lecture étendue ; la timeline compacte
  reste dépliable et sa hauteur réellement mesurée réserve l’espace des commandes. La croix de
  fermeture reste dans l’en-tête, l’action d’orbite rejoint ses données et le bandeau orange redondant
  disparaît sans retirer les explications scientifiques de la timeline et des fiches.
- Les deux parcours de molette fragiles attendent désormais la fin réelle de l’inertie et distinguent
  l’arrivée à la butée d’une nouvelle rafale de traversée. Leurs assertions de déplacement et
  d’orientation restent inchangées ; aucune correction de caméra n’est nécessaire pour ces tests.
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
  centre galactique jusqu’au Soleil tandis que le même nuage galactique reste visible et que les
  catalogues stellaires mesurés ajoutent du détail local par-dessus, sans coupure de référentiel.
  Cette trajectoire réversible commence
  dès l’Univers proche, sans lancer de recentrage de caméra aux changements hiérarchiques. Son pivot
  et son inclinaison sont évalués directement depuis la distance : ils s’immobilisent avec la molette
  et repartent sur la même courbe au retour, sans rattrapage qui ferait rebondir les étoiles. Le volume
  Gaia reste compact pendant toute l’approche extérieure, puis déploie son référentiel entre 3 600 et 2 400 unités pendant que
  ses catalogues restent masqués. Après une marge invisible, HYG, Gaia, les hôtes d’exoplanètes
  et les constellations apparaissent entre 900 et 90 unités dans un référentiel déjà fixe : le zoom
  ne peut donc plus faire glisser leurs étoiles. Cette décennie complète de zoom accompagne le
  passage proche dans le nuage, sans modifier le trajet de caméra. La luminosité galactique reste en outre bornée quel
  que soit l’angle de vue.
- La calibration structurelle de la Voie lactée utilise désormais la même échelle canonique pour
  le disque rendu et le Soleil, à tous les niveaux de zoom. La suppression de l’agrandissement
  indépendant par neuf replace les 8,178 kpc du Soleil à environ 53 % du rayon du disque documenté
  de 100 000 années-lumière. Le détail fin du nuage reste présent, sans modifier les distances de caméra,
  la réponse de la molette, le picking ni le
  placement des catalogues. La vue extérieure et la traversée reposent désormais sur le même nuage
  galactocentrique groupé, sans surface analytique, billboard ni image raster. De loin, la densité de
  ses points dessine une silhouette spirale irrégulière — deux bras dominants et deux secondaires,
  branches, barre, bulbe et intervalles sombres — puis ces mêmes points se séparent en étoiles par la
  perspective pendant l’approche. Des filaments ramifiés et irréguliers concentrent davantage les étoiles dans les bras,
  avec des intervalles moins lumineux ; le centre retrouve une barre dorée plus dense autour d’un
  noyau ivoire, évoquant ses étoiles âgées et non le trou noir. Ces couleurs et densités restent
  illustratives. Davantage
  d’étoiles fines remplacent le grain très brillant. La Galaxie vue de l’extérieur est donc réellement la population
  traversée à l’intérieur, sans échange d’objet visuel. Les 336 000 points de haute qualité
  appartiennent tous à la barre, aux bras, à l’éperon local ou au disque diffus. La composante
  épaisse couvre tous les azimuts et les deux côtés du plan ; le corridor calqué sur la caméra et
  la sphère distincte autour du Soleil ont été retirés. Aucune population de remplacement ne
  s’allume selon le zoom et aucune traînée artificielle n’est ajoutée.
  Le shader projette des diamètres en espace 3D selon le viewport réel, le champ de vision et la
  profondeur. Il conserve la contribution des points sous-pixel et limite les points résolus à un
  grain de poussière fin dans un support raster de quatre pixels. Les halos et l’amplification
  lumineuse à l’approche sont supprimés ; seuls les grains passant près de l’objectif s’atténuent
  progressivement. Une normalisation fixe maintient la lisibilité du nuage. Cet effet de densité
  est illustratif, pas une observation de poussières ; le rendu HYG/Gaia ne change pas.
  Une distribution illustrative de luminosité sépare les nombreux points fins des
  étoiles plus brillantes. Le bleu-blanc, l’ivoire et l’ambre stellaires, ainsi que quelques nœuds
  rosés de type H II, sont illustratifs, pas des couleurs Gaia mesurées individuellement.
  L’opacité du nuage reste constante jusqu’à 220 unités, puis diminue seulement entre 220 et 70,
  en chevauchant l’apparition de Gaia/HYG entre 900 et 90 unités. Les coordonnées des catalogues
  mesurés et la navigation restent inchangées. Les planètes ordinaires, leurs orbites et leurs
  étiquettes apparaissent séparément entre 240 et 90 unités, laissant d’abord une phase de nuage.
  Les noms des lunes deviennent secondaires et liés au système sélectionné ou ciblé ; le survol
  et la sélection directe restent disponibles. Les annotations d’échelle cosmique ne nomment plus
  le bulbe local. En qualité basse, 144 000 points moins lumineux couvrent le disque épais agrandi
  sans augmenter la lumière totale. Les tests vérifient les fondus distincts, la stabilité des points, la couverture du disque épais à chaque
  qualité et les pixels effectivement dessinés par les shaders.
  Le détail proche du nuage utilise maintenant un lot de points supplémentaire borné, avec trois
  résolutions spatiales et une faible densité diffuse entre les grains. Sa densité provient de la
  Galaxie affichée ; chaque grain garde une adresse galactique fixe. Seules des cellules déjà
  invisibles sont remplacées, pour conserver la parallaxe proche, les arrêts et le trajet inverse.
  Ce sont des poussières illustratives, pas de nouvelles étoiles de catalogue. La caméra et les
  coordonnées HYG/Gaia restent inchangées. La passe
  extérieure ajoute désormais un unique lot GPU de 12 000, 26 000 ou 48 000 étoiles clairsemées
  autour du disque selon la qualité, dont un huitième forme 48 concentrations compactes évoquant des
  amas globulaires. Cette enveloppe aplatie, fixe dans le référentiel galactique, produit uniquement
  une parallaxe de perspective et s'efface avant le voisinage solaire. Elle est explicitement
  illustrative et non cataloguée, sans brouillard ni émission diffuse. Une passe distincte, centrée
  sur la caméra, ajoute désormais 10 000, 24 000 ou 52 000 silhouettes étendues de galaxies autour
  de l’approche galactique. Leurs profils elliptiques, spiraux ou irréguliers constituent un
  échantillon représentatif explicitement illustratif — ni catalogue ni décompte littéral des
  galaxies — avec une zone d’évitement galactique analytique et sans parallaxe de translation. Le
  raccord de profondeur Cosmicflows emploie maintenant une lumière de groupes non résolus, inclinée
  et multilobée, plutôt que des points circulaires semblables à des étoiles. La passe
  extérieure ajoute aussi, uniquement aux distances où plusieurs galaxies sont observées, un shader
  sphérique procédural derrière ces silhouettes. Il produit un espace indigo profond, de larges
  structures filamenteuses cobalt et violettes, des failles presque noires et un grain de galaxies
  elliptiques non résolues, sans panorama raster ni positions cataloguées. Son fondu continu entre
  5 800 et 12 000 unités le maintient entièrement hors de la vue et de la traversée intérieures de la
  Voie lactée. La passe
  structurelle resserre et renforce les bandes de poussière en bord d’attaque et les deux bandes de la
  barre, retire l’essentiel du socle diffus du disque épais et compose leur extinction presque noire
  après le nuage stellaire additif. Un noyau ivoire compact, au sein de la barre ambrée, reste désormais
  distinct de la poussière comme de la lumière des bras.
- Les autres galaxies utilisent aussi des nuages fixes de points, avec des densités spirales,
  elliptiques ou irrégulières visibles depuis plusieurs angles. Les centres catalogués sont conservés ;
  les points internes et leurs couleurs restent illustratifs. La sélection conserve fiche et
  interactions sans dessiner un énorme anneau de sélection planétaire autour du nuage. Les captures
  et tests navigateur couvrent la Voie lactée, Andromède, M87 et le Grand Nuage de Magellan, avec
  vérification des pixels dessinés et de la stabilité spatiale ; l’approbation esthétique reste distincte.
- Une hiérarchie Gaia DR3 transforme 2 923 790 sources filtrées par qualité en agrégats calculés
  distants de 512 pc et en 133 526 échantillons de sources mesurées pour l’aperçu du voisinage
  stellaire. Chaque feuille raffinée de 512 pc conserve ses 32 sources les plus brillantes puis une
  sélection uniforme déterministe, jusqu’à 96 points. Le raffinement borné par le champ visible et
  la qualité ne charge que les branches utiles. Le raffinement teste les bornes plus précises des
  cellules enfants même lorsque le centre d’une large racine est hors écran, puis classe les racines
  éligibles selon leur nombre de sources mesurées visibles. La qualité haute peut raffiner au plus
  16 racines, ce qui évite qu’une rotation autour du Soleil ne laisse un côté de l’écran représenté
  seulement par des agrégats. Les changements de tuiles conservent le lot
  détaillé sortant et lui transfèrent l’opacité d’un fondu interrompu : même une rotation rapide ne
  provoque plus de chute temporaire de luminosité. Une courbe bornée agrandit légèrement et rend plus
  nettes les seules sources mesurées faibles ; elle réduit l’écart de densité perçue entre orientations
  sans ajouter de source, déplacer de coordonnée ni faire pomper l’exposition globale pendant une
  rotation. Les Workers module valident les branches et transfèrent leurs tableaux typés sans copie,
  sans jamais créer un objet Three.js par source.
  Les échantillons Gaia retenus conservent désormais leur identifiant source et sont directement
  sélectionnables et ciblables depuis leurs lots GPU partagés ; leur fiche expose les valeurs G et
  BP−RP mesurées ainsi que la distance calculée par inversion de parallaxe. Ils restent absents de la
  recherche globale et des noms affichés, tandis que les cellules agrégées restent anonymes. Le champ
  échantillonné demeure incomplet. Au dézoom, les échantillons détaillés fondent vers les racines
  calculées, qui restent discrètement visibles jusqu’au Groupe local tandis que le volume local se
  contracte selon une courbe logarithmique pour se fondre dans le disque de la Voie lactée.
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
  fond et une cible demandée explicitement reste chargée immédiatement. La campagne propre du
  28 août 2026, révision `27db0e1`, a réussi ses dix rapports. Les passages d’échelle moyenne/CPU 4× étaient à
  9,3 ms au p95 avec une pire image à 66,5 ms ; les passages faible/CPU 6× restent à 16,6–16,7 ms au
  p95 avec une pire image à 83,4 ms. Les passages observables résolvent Jupiter 3/3 dans les deux
  profils et les nombres de ressources ne dérivent pas dans cette référence historique.

## Priorités actuelles

- Les ancêtres de l’objet actif sont calculés une fois par image, et non pour chaque objet,
  en conservant la priorité de la cible et les changements de catalogue. Parents absents et cycles
  sont testés. Le cas isolé CPU 6× (503 entrées, 200 mises à jour) passe de 95,2–98,2 ms à
  74,6–80,3 ms, avec les mêmes états LOD. Caméra et règles de rendu restent inchangées ;
  ce résultat ne constitue pas un gain de FPS mesuré sur toute l’application.
  Les parcours à froid passent 3/3 par profil (pics de 66,8 ms low / 100,0 ms medium).
  Tempel atteint 27,0 / 31,2 ms en médiane, mais un pic medium à 78,2 ms reste hors budget.
- Le panorama 8K est désormais décodé de façon asynchrone avant son transfert GPU, sans changer
  sa résolution ni ses couleurs. Sous Chrome / CPU 6×, les transferts isolés passent de
  742,7–790,8 ms à 96,2–102,8 ms ; les pixels GPU échantillonnés sont identiques sous Chromium,
  Firefox et WebKit. La destruction de la texture libère le bitmap, même arrivé tardivement.
  Le préchauffage initial attend le panorama facultatif au plus 500 ms, en parallèle de la
  compilation des shaders, pour éviter de reporter son transfert local sur la première navigation.
  Les autres pics GPU et la campagne complète sur un état propre restent ouverts.
  Les parcours finaux passent 3/3 en low et 2/3 en medium (pics de 66,7 / 100,1 ms),
  sans assouplir le seuil de 100 ms. Les médianes Tempel sont de 26,6 / 28,4 ms et les six
  premières images restent sous 33,3 ms. Ces petites séries ne remplacent pas la campagne propre.
- Après la tranche recherche/labels du 11 septembre, les parcours ciblés passent 3/3 en low/CPU 6× et
  medium/CPU 4× (pires images à 100,0 et 99,9 ms). Tempel atteint 33,7 ms en médiane en low
  (hors budget) et 32,6 ms en medium, avec 3/3 préchargements réussis par profil. La pire latence
  globale ne s’améliore pas par rapport à la série précédente. Les pics par phase et la campagne
  complète sur révision propre restent ouverts ; ces résultats locaux ne remplacent pas la
  référence historique.
- La géométrie Cosmicflows et les symboles des grandes structures se préparent désormais par petits
  lots, tri stable et index de sélection compris, avec publication complète et nettoyage en cas
  d’annulation. Leurs registres préparent aussi identifiants, positions, classements et noms/alias
  par lots avant de publier une recherche complète en cache. Les identifiants, positions,
  préparations orbitales, classements d’hôtes et entrées de recherche des exoplanètes suivent
  désormais ce fonctionnement, sans modifier les liens aux objets de référence ni les valeurs
  scientifiques. Positions et apparence sont inchangées.
  L’index des tuiles stellaires prépare aussi sa table d’identifiants et ses volumes de visibilité
  par lots, sans publier d’index partiel. Les 3 964 cellules Gaia et les 378 combinaisons de vue
  testées restent identiques. Les noms et labels HYG se préparent désormais par lots en cache.
  Recherche et découverte des exoplanètes sont publiées ensemble une fois prêtes, en conservant
  la version précédente pendant le calcul et en abandonnant les travaux périmés après un changement
  de données ou de langue. Valeurs scientifiques et ordre des résultats restent inchangés.
  Les autres traitements stellaires, le premier travail GPU et la campagne complète sur révision
  propre restent ouverts.
- Premières optimisations CPU en place : masques de sélection incrémentaux, scores de classement
  précalculés et réutilisation bornée des mots-clés de recherche. Caméra et rendu sont inchangés.
  Les nouveaux parcours ciblés respectent les budgets globaux ; des pics par phase à froid et la
  campagne sur révision propre restent à traiter, sans remplacer la référence historique 10/10.
- Confirmer l’équilibre esthétique bras/cœur/halo et la sensation de traversée face aux références.
  La passe navigateur du 10 septembre vérifie la continuité du nuage, sa parallaxe, le relais HYG/Gaia
  et les galaxies externes sans anneau parasite. Cette validation technique ne remplace pas
  l’approbation visuelle. Distances physiques et trajectoire habituelle de caméra restent inchangées.
- Traiter les dépassements mesurés le 10 septembre sur le travail local non commité :
  **7 protocoles/profils sur 10 respectent leurs budgets**, sans constituer un manifeste officiel.
  Les traversées d’échelle dépassent les budgets en medium/CPU 4× et low/CPU 6×, avec des pics
  respectifs de 200 ms et 149,9 ms ; la première image Tempel atteint 49,8 ms en médiane en low.
  Démarrages, ressources et planétarium passent dans les deux profils ; Jupiter est résolu 3/3
  et les nombres de géométries, textures et appels de rendu ne dérivent pas.
- Profiler ces dépassements, puis relancer la campagne officielle sur une révision propre.
  Conserver entre-temps le manifeste historique 10/10, sans l’attribuer au rendu courant.
  Chrome 153 et le renderer Metal de l’hôte servent aux diagnostics locaux : ralentir le CPU
  ne simule ni un autre GPU ni une autre mémoire. La validation physique moyenne/faible reste
  facultative si du matériel adapté devient disponible.

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
