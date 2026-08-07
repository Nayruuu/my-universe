---
title: Navigazione e scale
description: Impara i controlli della camera, lo zoom semantico, i sistemi di riferimento, i bersagli e le transizioni di scala di Universe Map.
---

# Navigazione e scale

Universe Map si comporta come una mappa spaziale, non come un diagramma orbitale fisso. Velocità della
camera, distanza minima, etichette, rappresentazioni e sfondi si adattano al contesto astronomico.

## Controlli

| Azione                       | Desktop                          | Tocco                           |
| ---------------------------- | -------------------------------- | ------------------------------- |
| Ruotare attorno al bersaglio | Clic sinistro e trascinamento    | Trascinamento con un dito       |
| Traslare                     | Clic destro e trascinamento      | Trascinamento con due dita      |
| Zoom verso il puntatore      | Rotella del mouse                | Pizzicamento                    |
| Selezionare                  | Clic sull’oggetto o sul nome     | Tocco sull’oggetto o sul nome   |
| Mettere a fuoco              | Doppio clic, clic sul nome o `F` | Doppio tocco o tocco sul nome   |
| Avviare o fermare il tempo   | `Spazio`                         | Pulsante della linea temporale  |
| Cambiare velocità            | `+` o `-`                        | Selettore della linea temporale |
| Chiudere la scheda           | `Esc`                            | Pulsante Chiudi                 |

Lo zoom con la rotella segue il puntatore. Se un gesto verso l’interno inizia sul nome o sulla
rappresentazione di un oggetto navigabile, l’oggetto resta bloccato per tutta la raffica e diventa sia
il bersaglio di navigazione sia l’ancora dello zoom. L’avvicinamento è continuo e si arresta davanti
alla sua distanza minima contestuale; gli impulsi aggiuntivi della stessa raffica non possono
attraversarlo. Un cambio automatico di scala può ancora sostituire il bersaglio con il genitore o il
figlio logico richiesto dalla gerarchia. Nello spazio vuoto, il perno geometrico segue il puntatore.
Un bersaglio raggiunto viene liberato solo quando il puntatore non lo indica più; camera e perno
possono allora avanzare a distanza costante senza chiudere la scheda selezionata. Invertendo la
rotella si ripercorre questo tragitto libero prima che riprenda lo zoom indietro.

## Le sette scale della mappa

| Scala             | Contenuto tipico                                | Rappresentazione principale               |
| ----------------- | ----------------------------------------------- | ----------------------------------------- |
| Planetaria        | Superficie, atmosfera, anelli, lune             | Mesh e texture dettagliate                |
| Sistema solare    | Sole, pianeti, corpi minori e orbite            | Mesh adattive, etichette e traiettorie    |
| Vicinato stellare | Stelle HYG, ospiti di esopianeti, costellazioni | Lotti di punti GPU e dettagli selezionati |
| Via Lattea        | Disco, bulge, bracci e posizione locale         | Volume emissivo stratificato e cataloghi  |
| Gruppo Locale     | Via Lattea, Andromeda e satelliti               | Impostori galattici e volumi limitati     |
| Universo vicino   | Galassie e gruppi del volume locale             | Tessere spaziali e lotti panoramici       |
| Rete cosmica      | Gruppi, ammassi, vuoti e filamenti              | Punti, linee e volume di densità simulato |

La transizione è continua, ma ogni scala usa un riferimento interno diverso. Il renderer ricentra le
coordinate attorno alla camera quando serve per preservare la precisione numerica.

## Bersaglio, selezione ed etichette

- il **bersaglio logico** governa il percorso semantico e i limiti di distanza contestuali;
- il **perno geometrico** è il centro attorno al quale orbita la camera e segue lo zoom al puntatore;
- la **selezione** è l’oggetto mostrato nella scheda;
- un’**etichetta** è un’annotazione sullo schermo gestita contro le sovrapposizioni.

Fare clic su un’etichetta seleziona e centra l’oggetto. La densità può essere minima, bilanciata o
densa. Bersaglio, selezione e riferimenti principali hanno priorità. Il Sole resta visibile alle scale
stellari locali; più lontano la Via Lattea diventa il riferimento persistente.

Il menu delle scale consente salti diretti con la stessa interpolazione della ricerca. Se la vista
sembra vuota, verifica la scala, abilita le etichette, scegli densità bilanciata o densa, seleziona Sole
o Via Lattea oppure riduci la qualità su dispositivi lenti.

Continua con [Tempo ed eclissi](/it/time-and-eclipses/).
