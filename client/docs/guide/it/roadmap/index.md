---
title: Roadmap
description: Scopri ciò che Universe Map ha già rilasciato, le priorità attuali e il lavoro scientifico o prestazionale rinviato deliberatamente.
---

# Roadmap

_Ultima revisione: 27 agosto 2026._

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
- Ogni luogo fisso del catalogo dispone di un profilo di ostruzione a 360° calcolato dal prodotto
  autorevole di rilievo superficiale NOAA/NCEI ETOPO 2022 v1 a 60 secondi d’arco. I profili compatti
  vengono caricati su richiesta e possono nascondere stelle, Luna e pianeti dietro il terreno
  modellato; edifici, vegetazione, microrilievo e coordinate libere restano fuori dal modello. Tre
  inviluppi di distanza calcolati (0–30, 30–100 e 100–300 km) danno profondità alla silhouette;
  colore e illuminazione sono stilizzati.
- La Luna e i sette pianeti visibili riutilizzano oggetti Three.js, materiali, illuminazione e
  texture differite esistenti. Direzioni topocentriche e diametri angolari sono calcolati; la soglia
  minima di leggibilità resta esplicitamente illustrativa.
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
- Muri pubblicati, bacini probabilistici, attrattori e repulsori mantengono provenienza e simboli
  separati dalla rete di filamenti Tempel.
- Avvio a freddo, transizione Tempel, stabilità delle risorse e dei frame dispongono di benchmark
  browser ripetibili.

## Priorità attuali

- Definire contratti di luce ricevuta adeguati alle fonti per galassie e strutture su larga scala.
  Richiedono una semantica cosmologica del tempo di sguardo all’indietro e del redshift invece della
  sola distanza divisa per la velocità della luce.

Il planetario resta una proiezione topocentrica distinta del luogo selezionato. La mappa temporale
Luce ricevuta usa la Terra per i corpi supportati del Sistema solare e il baricentro del Sistema
solare per le stelle HYG e i sistemi esoplanetari documentati.

## Prossimi investimenti misurati

- Eseguire i benchmark Tempel, avvio, memoria e frequenza dei frame su dispositivi fisici
  rappresentativi di fascia bassa, media e alta. Precompilazione degli shader o fallback più costosi
  saranno aggiunti solo quando le misure ne giustificano il costo.

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
