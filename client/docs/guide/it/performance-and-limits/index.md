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

## Stato delle misure fisiche

Una misura ripetuta del 27 agosto 2026 ha usato un MacBook Pro di fascia alta con Apple M5 Max,
macOS 26.6, Chrome 151, il vero renderer Metal, qualità desktop/alta e rapporto pixel 1. In tre prove,
la mediana della prima mappa utilizzabile è stata 259,3 ms e quella del primo frame visibile di Tempel
7,1 ms. Tre viaggi a freddo sono rimasti a 9,1–9,2 ms al p95, 16,7 ms al p99, 66,6–75 ms massimi e
0,24–0,36% di frame lunghi. Dopo tre riscaldamenti, tre cicli sono rimasti a 100 geometrie, 18 texture
e 44 draw call; l’heap raccolto è diminuito di 0,77 MiB.

Un profilo separato del planetario osservabile ha richiesto DPR 2 al browser a 1440 × 900 pixel CSS.
Il renderer in qualità alta ha applicato il limite DPR 1,5 documentato ed è rimasto stabile in tutte
e tre le prove. Ogni prova ha campionato 1452–1455 frame a 9,1 ms al p95, 9,3 ms al p99,
9,4–9,5 ms massimi e senza frame lunghi; Giove ha raggiunto la rappresentazione risolta in tutte e tre.

Una campagna simulata pulita sullo stesso host, registrata il 28 agosto 2026 dalla revisione
`27db0e1`, ha superato tutti e dieci i rapporti. Con qualità media e CPU 4×, la prima mappa utilizzabile
mediana è arrivata in 1,26 s, il primo frame visibile di Tempel mediano in 24,2 ms, i tre percorsi di
scala a freddo sono rimasti a 9,3 ms p95 con un frame peggiore di 66,5 ms e i percorsi osservabili a
9,2 ms p95 mediano con un frame peggiore di 24,9 ms e Giove risolto 3/3. Con qualità bassa e CPU 6×, i
valori corrispondenti sono stati 1,85 s, 33,1 ms, 16,6–16,7 ms p95 con un frame di scala peggiore di
83,4 ms e 9,4 ms p95 osservabile con un frame peggiore di 41,7 ms e Giove risolto 3/3. Entrambi i
protocolli delle risorse hanno mantenuto invariati i conteggi di geometrie, texture e draw call per
tre cicli. La GPU è rimasta la M5 Max: questi dati misurano il margine contro le regressioni, non
hardware fisico rappresentativo di fascia media o bassa.

Tutti e cinque i benchmark delle prestazioni — avvio, Tempel, risorse, frame tra scale e planetario
osservabile — possono scrivere lo stesso rapporto di evidenza JSON versionato con
`UNIVERSE_BENCHMARK_REPORT_PATH`. Registra revisione Git e stato dirty, caratteristiche dell’host,
browser e renderer WebGL, configurazione, campioni e riepilogo.
`UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL=1` rifiuta rallentamento CPU, rendering software o l’assenza di
una `UNIVERSE_BENCHMARK_DEVICE_CLASS` dichiarata prima di scrivere il rapporto, impedendo a una
simulazione di entrare silenziosamente nella matrice fisica.

`npm run benchmark:campaign` esegue i cinque protocolli in sequenza su un computer fisico
rappresentativo. Richiede un checkout Git pulito e una classe e un’etichetta dichiarate, disattiva il
rallentamento CPU, impone budget rigorosi e almeno tre ripetizioni e usa per impostazione predefinita
la qualità associata alla classe. Scrive cinque rapporti fuori dal repository e un manifesto
`universe-map/performance-campaign@1` che li collega tramite digest SHA-256. Il comando confeziona
evidenze confrontabili; non trasforma un computer in un’altra classe.

`npm run benchmark:campaign:simulated` offre una campagna di stress separata sullo stesso host quando
non è disponibile hardware rappresentativo. Il rallentamento CPU di Chrome si applica a tutti e
cinque i protocolli: qualità media a 4× con DPR osservatore 1,25, poi qualità bassa a 6× con DPR 1. I
dieci benchmark restano sequenziali e, da un checkout pulito, generano un manifesto
`universe-map/simulated-performance-campaign@1` con digest SHA-256 e limiti espliciti. GPU, memoria
grafica, driver, larghezza di banda della memoria e comportamento termico restano quelli dell’host;
media e bassa sono proxy di regressione, mai evidenze di dispositivi fisici. Un budget superato non
interrompe più i protocolli successivi: il manifesto completo marca ogni protocollo, profilo e
campagna con `withinBudget`, poi la modalità rigorosa restituisce l’errore.
`UNIVERSE_BENCHMARK_STRICT=0` serve solo a raccogliere deliberatamente una baseline già nota come
regressiva.

La baseline fisica ripetuta documenta ancora soltanto la fascia alta. Le misure fisiche di fascia
media e bassa diventano un controllo futuro facoltativo, non un blocco quando manca l’hardware.

## Pannello di debug

Aggiungi `?debug=true` all’URL per visualizzare FPS, draw call, triangoli, geometrie, texture, oggetti
visibili, riferimento, distanza camera, bersaglio, Giorno Giuliano e qualità.

```text
https://super-universe.app/it/?debug=true
```

## Requisiti e limiti noti

Sono richiesti JavaScript, WebGL 2, memoria GPU sufficiente ed eventi del puntatore. In caso di avviso,
riduci il profilo grafico invece dello zoom del browser.

Il catalogo non è esaustivo; raggi e transizioni sono adattati; Luce ricevuta corregge i corpi
supportati del Sistema solare — incluse lune galileiane, satelliti semplificati, pianeti nani, asteroidi
e comete — e le stelle HYG per il tempo di viaggio della luce; i sistemi esoplanetari documentati
condividono un ritardo derivato dalla distanza pubblicata della stella ospite, mentre le fasi
planetarie locali restano illustrative e i sistemi senza distanza simultanei; galassie e strutture su
larga scala usano il tempo geometrico di catalogo oppure il tempo di sguardo all’indietro ΛCDM
dedotto dalla distanza di luminosità o comovente; posizioni, forme e misure restano statiche;
le indagini cosmologiche hanno coperture diverse;
l’assenza di un rilevamento non prova un vuoto fisico; superfici dettagliate, meteo in tempo reale e
ray tracing relativistico esatto restano fuori ambito.

Se la navigazione rallenta, passa a qualità bassa, chiudi altre schede che usano la GPU e torna a un
bersaglio noto. Se manca un dataset statico, controlla il file specifico nel pannello di rete.

Continua con [Guida per sviluppatori](/it/developers/).
