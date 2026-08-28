---
title: Roadmap
description: Scopri ciò che Universe Map ha già rilasciato, le priorità attuali e il lavoro scientifico o prestazionale rinviato deliberatamente.
---

# Roadmap

_Ultima revisione: 28 agosto 2026._

Questa pagina è la roadmap pubblica di riferimento di Universe Map. Descrive risultati e criteri di
verifica invece di promettere date. Accuratezza scientifica, navigazione leggibile, tempi di frame
stabili e architettura completamente statica nel browser vincolano ogni sviluppo.

## Come leggere gli stati

| Stato      | Significato                                                            |
| ---------- | ---------------------------------------------------------------------- |
| Rilasciato | Disponibile nell’applicazione corrente e coperto da test automatici    |
| Attuale    | Prossimi miglioramenti dell’esperienza esistente                       |
| Successivo | Richiede prima un contratto scientifico o misure su dispositivi fisici |
| Rinviato   | Utile solo con nuove fonti, dati o un catalogo più denso               |

## Rilasciato

- Il **planetario per osservatori terrestri** offre un cielo HYG con 10.000 stelle liberamente
  orientabile, costellazioni moderne, altezza e azimut, campo visivo da 102° a 2° ancorato al
  puntatore, 461 luoghi ripristinabili dall’URL, geolocalizzazione del browser su consenso arrotondata
  a tre decimali e contesti di scena locali illustrativi.
- Un pianificatore locale su richiesta ordina Luna, pianeti e satelliti catalogati visibili per altezza
  e valuta le 48 stelle più luminose del catalogo per proporne fino a otto visibili. La selezione apre
  i dettagli esistenti e ricentra il cielo. Orizzonte calcolato e ostruzione del rilievo vengono
  applicati quando disponibili. Il bersaglio attivo dispone ora di una curva di altezza calcolata su
  24 ore con sorgere, culminazione, tramonto, fasce di crepuscolo USNO, disturbo lunare, indice della
  finestra migliore esplicitamente illustrativo e un’azione che sposta insieme tempo e camera. Il
  bersaglio della curva può essere sostituito dallo stesso catalogo locale senza muovere il cielo
  corrente; solo quell’azione conferma bersaglio, tempo condiviso e camera. Un confronto compatto
  applica lo stesso calcolo a sette notti consecutive. Evidenzia automaticamente la migliore con un
  indice illustrativo comparabile su 100 e mostra altezza, oscurità, luce lunare e margine dal rilievo
  prima dell’azione diretta verso l’istante migliore, raffinato localmente a cinque minuti. Meteo in
  tempo reale, inquinamento luminoso e ostacoli locali non rilevati restano fuori dal modello.
- Ogni luogo fisso del catalogo dispone di un profilo di ostruzione a 360° calcolato dal prodotto
  autorevole di rilievo superficiale NOAA/NCEI ETOPO 2022 v1 a 60 secondi d’arco. I profili compatti
  vengono caricati su richiesta e possono nascondere stelle, Luna, pianeti e satelliti dietro il terreno
  modellato; edifici, vegetazione, microrilievo e coordinate libere restano fuori dal modello. Tre
  inviluppi di distanza calcolati (0–30, 30–100 e 100–300 km) danno profondità alla silhouette;
  colore e illuminazione sono stilizzati.
- La Luna, i sette pianeti visibili e altri venti satelliti catalogati riutilizzano oggetti Three.js,
  materiali, illuminazione e texture differite esistenti. Direzioni topocentriche e diametri angolari
  usano distanze orbitali fisiche: le posizioni galileiane sono calcolate e le altre sedici traiettorie
  da elementi medi J2000 restano indicate come estrapolate. I satelliti appaiono da un campo di 12°,
  o subito quando sono il bersaglio, per evitare sovrapposizioni nel grandangolo; la soglia minima di
  leggibilità resta esplicitamente illustrativa.
- Stelle e Via Lattea acquisiscono dettaglio in modo continuo durante lo zoom. La navigazione elimina
  anche bersagli e selezioni quando il loro contesto visivo scompare.
- Le velocità cartesiane J2000 di HYG propagano ora il catalogo condiviso, il cielo dell’osservatore
  e le figure delle costellazioni, con affidabilità estrapolata esplicita e limite di ±10.000 anni
  giuliani.
- La modalità temporale **Luce ricevuta** considera ora la data selezionata come data di ricezione.
  Retrodata Sole, Luna e pianeti dalla Terra con Astronomy Engine e risolve una data ritardata
  individuale per ogni stella HYG dal baricentro del Sistema solare. Le rotazioni assiali supportate
  usano quella data di emissione, le schede mostrano ritardo e data di emissione e il modello HYG
  conserva il limite esplicito di ±10.000 anni giuliani.
- Le lune galileiane usano Astronomy Engine alla loro data ricevuta dalla Terra. Gli altri satelliti,
  pianeti nani, asteroidi e comete documentati risolvono iterativamente il tempo di viaggio geometrico
  con gli elementi JPL a due corpi esistenti; la confidenza resta estrapolata e l’amplificazione visiva
  delle distanze resta fuori dal calcolo scientifico.
- I sistemi esoplanetari documentati condividono ora un ritardo baricentrico derivato dalla distanza
  della stella ospite pubblicata dalla NASA. La direzione statica della stella non cambia e ogni orbita
  planetaria locale è valutata a quella data di emissione, ma la fase resta esplicitamente
  illustrativa; i sistemi senza distanza pubblicata restano simultanei.
- Le galassie vicine usano ora il tempo geometrico della distanza di catalogo. I moduli di distanza
  Cosmicflows-4 sono trattati come distanze di luminosità e le distanze cartografiche delle strutture
  su larga scala come distanze comoventi; entrambe sono invertite nel modello ΛCDM piatto documentato.
  Le schede mostrano redshift dedotto e tempo di sguardo all’indietro, mentre posizioni e aspetti
  statici restano invariati e il risultato è indicato come estrapolato.
- Muri pubblicati, bacini probabilistici, attrattori e repulsori mantengono provenienza e simboli
  separati dalla rete di filamenti Tempel.
- Avvio a freddo, transizione Tempel, stabilità delle risorse e dei frame dispongono di benchmark
  browser ripetibili.
- Una baseline fisica ripetuta di fascia alta documenta ora tre prove di avvio, Tempel e frame a
  freddo, più tre cicli di risorse dopo il riscaldamento su un Apple M5 Max con il vero renderer
  Metal. Non è un’evidenza per un’altra classe di dispositivi.
- Un benchmark dedicato al planetario osservabile copre ora il movimento reale del cielo, il
  ricentraggio, la transizione ancorata a Giove verso il pianeta risolto condiviso e lo zoom
  all’indietro. Tre prove fisiche Retina di fascia alta sono riuscite al limite DPR 1,5 della qualità
  alta senza frame lunghi. Una matrice separata di stress CPU 4×/6×, esplicitamente simulata, riesce
  anch’essa e misura solo il margine contro le regressioni.
- Tutti e cinque i protocolli manuali delle prestazioni condividono ora un rapporto di evidenza JSON
  versionato che registra stato del sorgente, host, renderer, configurazione, campioni e riepilogo.
  Un controllo fisico rifiuta misure simulate, renderizzate via software o non classificate prima di
  scrivere il rapporto. Un esecutore di campagna con checkout pulito li avvia in sequenza e collega i
  cinque file in un manifesto verificabile tramite SHA-256.
- Un comando separato con checkout pulito esegue ora la campagna di regressione media e bassa sullo
  stesso host per tutti e cinque i protocolli: qualità media con CPU 4× e qualità bassa con CPU 6×. Il
  manifesto simulato distinto collega dieci rapporti e dichiara che GPU, memoria, driver, larghezza di
  banda e comportamento termico restano quelli dell’host sorgente.
- I quattro cataloghi complementari vengono ora scaricati e decodificati in un Worker modulo
  dedicato, trasferendo i buffer tipizzati senza copie. La preparazione non crea risorse di scena;
  quando termina, l’installazione sul thread principale di registri, ricerca, geometrie e GPU richiede
  una nuova finestra di 1,2 secondi con camera stabile. Ogni transizione azzera il ritardo, la modalità
  osservabile sospende del tutto l’installazione in background e un obiettivo richiesto esplicitamente
  continua a caricarsi subito. La campagna pulita della revisione supera ora tutti e dieci i rapporti.
  I percorsi di scala media/CPU 4× restano a 9,3 ms p95 con un frame peggiore di 66,5 ms; bassa/CPU 6×
  resta a 16,6–16,7 ms p95 con un frame peggiore di 83,4 ms. I percorsi osservabili risolvono Giove
  3/3 in entrambi i profili e i conteggi delle risorse non derivano.

## Priorità attuali

- Conservare il manifesto simulato pulito riuscito 10/10 come baseline di regressione e ripetere la
  campagna dopo modifiche sostanziali al rendering o ai cataloghi. Le prove attuali non giustificano
  né un percorso di precompilazione degli shader più pesante né un fallback meno fedele; la
  validazione fisica media/bassa resta facoltativa se diventa disponibile hardware adatto. I profili
  simulati restano controlli di regressione, non dichiarazioni sui dispositivi.

Il planetario resta una proiezione topocentrica distinta del luogo selezionato. La mappa temporale
Luce ricevuta usa la Terra per i corpi supportati del Sistema solare e il baricentro del Sistema
solare per le stelle HYG e i sistemi esoplanetari documentati.

## Rinviato deliberatamente

- La gerarchia stellare aggregata preparata resta inattiva finché un catalogo più denso non richiede
  una rappresentazione visibile tra le scale. L’attivazione dovrà spostare la preparazione in un Web
  Worker ed evitare lavoro invisibile di rete o GPU.
- Nuove sagome o mesh di corpi irregolari saranno aggiunte solo quando un modello di forma autorevole
  giustificherà download, decodifica, attribuzione e costo di rendering.

## Confini del prodotto

La roadmap non promette un Universo esaustivo, meteo in diretta, esplorazione del suolo, simulazione
gravitazionale completa o ray tracing relativistico. Consulta
[Affidabilità scientifica](/it/scientific-confidence/) e
[Prestazioni e limiti](/it/performance-and-limits/) per il contratto attuale.

Continua con [Informazioni sul progetto](/it/about/).
