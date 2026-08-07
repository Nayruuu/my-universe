---
title: Prestazioni e limiti
description: Comprendi profili grafici, caricamento progressivo, batch GPU, requisiti del browser, metriche di debug e limiti di Universe Map.
---

# Prestazioni e limiti

Universe Map punta a 60 fotogrammi al secondo su un desktop moderno e 30 su mobile. Un tempo di frame
stabile è più importante che mostrare ogni punto disponibile nello stesso istante.

## Come il rendering resta sotto controllo

- stelle, ospiti di esopianeti, gruppi e grandi strutture usano batch di punti o linee GPU;
- non viene creato un oggetto Three.js per ogni record dei grandi cataloghi;
- gli indici spaziali caricano solo le tessere rilevanti per la camera;
- texture e materiali dettagliati arrivano vicino al livello di dettaglio utile;
- i calcoli orbitali hanno frequenza ridotta e sono interpolati;
- le etichette rispettano budget di scala, qualità e collisione;
- gli effetti volumetrici adattano campioni e pixel alla qualità;
- il ciclo di rendering gira fuori dal rilevamento modifiche di Angular.

## Profili grafici

| Profilo | Uso                                              | Riduzioni tipiche                                        |
| ------- | ------------------------------------------------ | -------------------------------------------------------- |
| Basso   | Telefoni, portatili vecchi, risparmio energetico | Meno punti, texture piccole, volumi brevi e meno tessere |
| Medio   | GPU integrate e uso generale                     | Densità e post-elaborazione bilanciate                   |
| Alto    | Hardware desktop recente                         | Cataloghi, texture, volumi e dettagli più ricchi         |

Il profilo non cambia mai le coordinate scientifiche.

## Pannello di debug

Aggiungi `?debug=true` all’URL per visualizzare FPS, draw call, triangoli, geometrie, texture, oggetti
visibili, riferimento, distanza camera, bersaglio, Giorno Giuliano e qualità.

```text
https://super-universe.app/it/?debug=true
```

## Requisiti e limiti noti

Sono richiesti JavaScript, WebGL 2, memoria GPU sufficiente ed eventi del puntatore. In caso di avviso,
riduci il profilo grafico invece dello zoom del browser.

Il catalogo non è esaustivo; raggi e transizioni sono adattati; la modalità osservabile non simula
ancora completamente il tempo di viaggio della luce; le indagini cosmologiche hanno coperture diverse;
l’assenza di un rilevamento non prova un vuoto fisico; superfici dettagliate, meteo in tempo reale e
ray tracing relativistico esatto restano fuori ambito.

Se la navigazione rallenta, passa a qualità bassa, chiudi altre schede che usano la GPU e torna a un
bersaglio noto. Se manca un dataset statico, controlla il file specifico nel pannello di rete.

Continua con [Guida per sviluppatori](/it/developers/).
