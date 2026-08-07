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

Il bersaglio definisce il perno della camera, mentre la selezione definisce la scheda informativa.
Normalmente coincidono dopo una ricerca o un clic su un’etichetta, ma possono separarsi durante la
navigazione libera.

## Qualità grafica e condivisione

- **Bassa** riduce particelle, texture, volumi e tessere;
- **Media** bilancia dettaglio e costo GPU;
- **Alta** abilita la rappresentazione più ricca prevista alla scala corrente.

La qualità non cambia coordinate o affidabilità scientifica. Il pulsante di condivisione copia un URL
che conserva bersaglio, selezione, data, zoom, modalità temporale, qualità, densità dei nomi, orbite,
costellazioni ed etichette. L’indirizzo viene aggiornato con un breve ritardo, non a ogni fotogramma.

Continua con [Navigazione e scale](/it/navigation/).
