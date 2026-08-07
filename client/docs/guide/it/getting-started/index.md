---
title: Primi passi
description: Apri Universe Map, scopri l’interfaccia, scegli un profilo grafico e condividi la tua prima vista astronomica.
---

# Primi passi

Universe Map funziona interamente in un browser moderno. Non richiede un account né un backend
applicativo. Cataloghi, texture e modelli sono file statici caricati progressivamente al cambiare della
scala della camera.

## Aprire la mappa

Visita [super-universe.app](https://super-universe.app/it/). La prima vista carica il motore di
rendering e il manifesto compatto; i dataset stellari e galattici più grandi vengono richiesti solo
quando servono.

Per una buona prima esperienza:

1. usa un browser desktop recente con WebGL 2 attivo;
2. mantieni la qualità **Alta** con una GPU recente;
3. attendi che l’indicatore di caricamento scompaia;
4. scorri sopra un oggetto visibile o fai clic sul suo nome.

La mappa supporta anche il tocco e riduce automaticamente la densità sui dispositivi piccoli.

## Panoramica dell’interfaccia

| Area              | Funzione                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Ricerca superiore | Trova pianeti, lune, stelle, esopianeti, galassie, buchi neri, supernove e grandi strutture. |
| Percorso di scala | Mostra la gerarchia astronomica e consente di raggiungere direttamente un livello superiore. |
| Scheda oggetto    | Mostra fonti, alias, proprietà fisiche, affidabilità e azioni di messa a fuoco.              |
| Controlli mobili  | Zoom, ritorno a Terra o Sole e interruttori per orbite, costellazioni e nomi.                |
| Linea temporale   | Modifica l’ora UTC, pausa o riproduzione, velocità ed eventi di eclissi.                     |
| Scala della mappa | Indica una scala visiva adattata al contesto della camera.                                   |

## Un primo viaggio

1. cerca **Terra** e seleziona il risultato;
2. usa rotella o gesto di pizzicamento per uscire dal Sistema solare;
3. seleziona **Sole** e continua verso il vicinato stellare;
4. scegli **Via Lattea** dal menu delle scale;
5. prosegui verso Gruppo Locale, Universo vicino e rete cosmica;
6. usa il percorso gerarchico per tornare al Sistema solare.

Il bersaglio logico definisce la gerarchia e i limiti di distanza, il perno geometrico definisce il
centro orbitale e la selezione definisce la scheda informativa. Una messa a fuoco esplicita li allinea
spesso, ma lo zoom verso il puntatore e la navigazione libera possono separarli.

## Osservare una stella dall’orizzonte terrestre

Cerca una stella come **Sirio**, apri la sua scheda e scegli **Localizza dalla Terra**. La vista del
cielo locale usa la data e il luogo di osservazione della mappa. Trascina per guardarti intorno,
modifica il campo visivo con la rotella o il pizzicamento e usa **Ricentra** per ritrovare il bersaglio.
Sono comandi del planetario: mentre la vista Orizzonte è aperta, la rotella non attiva cambi semantici
di scala né spostamenti alla distanza minima. Il selettore offre 461 luoghi di osservazione statici
nel mondo; osservatore e vista planetario restano nel link condiviso. **Usa la mia posizione** chiede
il permesso del browser solo dopo la selezione, arrotonda le coordinate a tre decimali (circa 100 m)
e usa quindi lo stesso contratto di osservatore condivisibile.

La Luna e i pianeti visibili riutilizzano gli stessi oggetti Three.js, materiali, illuminazione e
texture documentate o adattate della mappa. Direzioni topocentriche e diametri angolari sono calcolati
per il luogo e l’istante scelti. Una dimensione minima limitata mantiene leggibili i pianeti piccoli ed
è esplicitamente illustrativa, non una dichiarazione della loro dimensione angolare reale.

L’orizzonte segue l’azimut dello sguardo e rimane solidale con il suolo mentre il cielo segue il tempo.
Otto città in evidenza hanno contesti visivi composti a mano; ogni luogo del catalogo carica su
richiesta quattro punti di riferimento vicini da pacchetti regionali statici. Nomi, coordinate o
altezze documentati non rendono la skyline una misurazione: terreno, luci, livelli urbani e sagome
generiche restano esplicitamente illustrativi. La vista non sostituisce un profilo topografico
rilevato, dati meteo, una ricostruzione storica o uno strumento professionale di pianificazione.

## Qualità grafica e condivisione

- **Bassa** riduce particelle, texture, volumi e tessere;
- **Media** bilancia dettaglio e costo GPU;
- **Alta** abilita la rappresentazione più ricca prevista alla scala corrente.

La qualità non cambia coordinate o affidabilità scientifica. Il pulsante di condivisione copia un URL
che conserva bersaglio, selezione, data, zoom, modalità temporale, qualità, densità dei nomi, orbite,
costellazioni ed etichette. L’indirizzo viene aggiornato con un breve ritardo, non a ogni fotogramma.

Continua con [Navigazione e scale](/it/navigation/).
