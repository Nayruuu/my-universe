---
title: Roadmap
description: Scopri ciò che Universe Map ha già rilasciato, le priorità attuali e il lavoro scientifico o prestazionale rinviato deliberatamente.
---

# Roadmap

_Ultima revisione: 3 settembre 2026._

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
  anche bersagli e selezioni quando il loro contesto visivo scompare. Entrando nella Galassia, il
  perno della camera avanza continuamente dal centro galattico al Sole mentre volume esterno,
  catalogo stellare e fascia panoramica locale sfumano senza un taglio di sistema di riferimento.
- La calibrazione strutturale della Via Lattea separa ora la metrica fisica e spaziale canonica
  dall’inviluppo luminoso esplicitamente illustrativo. All’ingresso galattico, l’inviluppo raggiunge
  quattro volte il diametro canonico e cresce per l’intero avvicinamento logaritmico, senza cambiare
  distanze della camera, risposta della rotellina, picking o posizioni dei cataloghi. Per rendere
  percepibile l’attraversamento senza rallentare la camera, la stessa nuvola di punti raggruppata
  include 140.000 traccianti deterministici e illustrativi: 28.000 restano distribuiti nel disco spesso
  galattocentrico, 56.000 formano un inviluppo d’ingresso curvo e simmetrico attorno all’asse galattico
  e 56.000 compongono un nucleo più stretto per i passaggi ravvicinati. Ogni livello di qualità copre
  l’intero raggio e tutti gli azimut del nucleo, evitando tratti vuoti lungo il percorso. Tutte le
  posizioni restano statiche; solo gli sprite più vicini si allungano brevemente mentre cambia la
  distanza della camera e tornano rotondi quando questa si ferma. Il loro scorrimento apparente deriva
  dalla traslazione e dalla prospettiva della camera, non da un moto indipendente delle particelle. Durante l’attraversamento, il velo
  volumetrico e le particelle morfologiche morbide ora arretrano prima dei traccianti lontani, lasciando
  stelle di prossimità più rare e nitide invece di una grana polverosa uniforme. Le etichette delle
  galassie del Gruppo Locale svaniscono prima dell’attraversamento denso, mentre il bersaglio attivo
  resta leggibile. I traccianti non sono singole stelle catalogate. La componente bianca del volume è
  ora trattata esplicitamente come luce integrata illustrativa di stelle non risolte, non come polvere:
  il fondo continuo tra i bracci è ridotto, mentre bracci, filamenti e ammassi mantengono luci separate
  da intervalli scuri. La fase cromatica successiva separa ora la luce integrata avorio caldo, le stelle
  giovani color zaffiro, il nucleo ambrato, rari accenti H II magenta e la polvere quasi nera. Un fondo
  contenuto di stelle puntiformi zaffiro, avorio, ambra e rosse colma inoltre il passaggio tra 1.400 e
  2.800 unità senza ripristinare un velo di polvere diffuso. Questa popolazione resta esplicitamente
  procedurale e decorativa, non un insieme di sorgenti catalogate singolarmente. Un passaggio di
  luminanza ponderato sulla profondità aumenta ora i nuclei delle stelle puntiformi, soprattutto per i
  traccianti di passaggio ravvicinato, senza schiarire il velo volumetrico né il nero tra le stelle.
- Una gerarchia Gaia DR3 rappresenta 2.923.790 sorgenti filtrate per qualità mediante aggregati
  calcolati lontani da 512 pc e 133.526 campioni di sorgenti misurate per la panoramica del vicinato
  stellare. Ogni foglia raffinata da 512 pc conserva le 32 sorgenti più luminose e una selezione
  uniforme deterministica, fino a 96 punti. Il raffinamento limitato da visibilità e qualità carica
  solo i rami utili, li valida in Worker modulo, trasferisce array tipizzati senza copie e non crea
  mai un oggetto Three.js per sorgente. Ricerca esatta, nomi, selezione e messa a fuoco restano basati
  su HYG; i campioni Gaia sono esplicitamente anonimi e incompleti. Allontanando lo zoom, i campioni
  dettagliati sfumano nelle radici calcolate, che restano discretamente visibili fino al Gruppo
  Locale, mentre il volume locale si fonde nel disco della Via Lattea con una scala logaritmica.
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

- Completare la calibrazione visiva della Via Lattea rispetto al passaggio di riferimento. Con le fasi
  di chiarezza interna, separazione della luce integrata, palette cromatica e raccordo stellare già in
  opera, la successiva regolerà il contrasto strutturale delle bande di polvere e del nucleo prima di
  verificare tutti e tre i profili di qualità e i benchmark di rendering. Le distanze fisiche canoniche
  resteranno invariate.
- Conservare il manifesto simulato pulito riuscito 10/10 come baseline di regressione e ripetere la
  campagna dopo modifiche sostanziali al rendering o ai cataloghi. Le prove attuali non giustificano
  né un percorso di precompilazione degli shader più pesante né un fallback meno fedele; la
  validazione fisica media/bassa resta facoltativa se diventa disponibile hardware adatto. I profili
  simulati restano controlli di regressione, non dichiarazioni sui dispositivi.

Il planetario resta una proiezione topocentrica distinta del luogo selezionato. La mappa temporale
Luce ricevuta usa la Terra per i corpi supportati del Sistema solare e il baricentro del Sistema
solare per le stelle HYG e i sistemi esoplanetari documentati.

## Rinviato deliberatamente

- Nuove sagome o mesh di corpi irregolari saranno aggiunte solo quando un modello di forma autorevole
  giustificherà download, decodifica, attribuzione e costo di rendering.

## Confini del prodotto

La roadmap non promette un Universo esaustivo, meteo in diretta, esplorazione del suolo, simulazione
gravitazionale completa o ray tracing relativistico. Consulta
[Affidabilità scientifica](/it/scientific-confidence/) e
[Prestazioni e limiti](/it/performance-and-limits/) per il contratto attuale.

Continua con [Informazioni sul progetto](/it/about/).
