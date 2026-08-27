---
title: Tempo ed eclissi
description: Comprendi tempo UTC, velocità, effemeridi planetarie, rotazione assiale e visualizzazione delle eclissi in Universe Map.
---

# Tempo ed eclissi

La linea temporale controlla internamente un Giorno Giuliano numerico. L’interfaccia accetta una data
civile UTC e la converte prima di inviarla al motore di rendering.

## Controlli temporali

Puoi inserire data e ora UTC, avviare o mettere in pausa, tornare al presente, scegliere un
moltiplicatore adatto alla scala corrente e sfogliare eclissi passate e future documentate. In pausa,
posizioni orbitali e rotazione assiale rimangono ferme; alla ripresa derivano dallo stesso tempo
interno e non dal numero di fotogrammi.

## Modalità temporali

**Stato alla data selezionata** mostra lo stato stimato degli oggetti nello stesso istante ed è la
modalità principale implementata.

**Luce ricevuta** considera la data selezionata come data di ricezione. I corpi supportati del Sistema
solare sono osservati dalla Terra e le stelle HYG dal baricentro del Sistema solare. Ogni oggetto
supportato è calcolato alla propria data di emissione; anche la rotazione assiale usa quella data. La
scheda mostra il tempo di viaggio della luce calcolato e la data di emissione.

La modalità copre attualmente Sole, Luna, pianeti, lune galileiane, satelliti a due corpi documentati,
pianeti nani, asteroidi, comete, stelle HYG e sistemi esoplanetari con distanza pubblicata della stella
ospite. I corpi forniti da Astronomy Engine mantengono una confidenza calcolata. Gli altri oggetti del
Sistema solare risolvono iterativamente il ritardo ricevuto dalla Terra con gli stessi elementi medi o
osculatori JPL usati dalla mappa; il risultato resta quindi esplicitamente estrapolato.
L’amplificazione visiva delle distanze non entra mai nel calcolo.

Per un sistema esoplanetario, la
[distanza di sistema NASA PSCompPars](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
determina un ritardo baricentrico comune alla stella e ai suoi pianeti secondo la
[definizione IAU del parsec](https://www.iau.org/static/resolutions/IAU2015_English.pdf). La direzione
statica della stella non cambia perché questo livello non ne ricostruisce il moto proprio. Le orbite
planetarie locali sono valutate alla data di emissione comune, ma fase, orientamento e scala visiva
restano esplicitamente illustrativi. I sistemi senza distanza pubblicata restano simultanei. Galassie
e strutture su larga scala dispongono ora di un contratto specifico per la luce ricevuta.

Le galassie vicine con distanza di catalogo usano il tempo di viaggio geometrico senza spostare la
posizione 3D statica. I moduli di distanza Cosmicflows-4 sono interpretati come distanze di luminosità
e le distanze visuali delle strutture su larga scala come distanze comoventi. Entrambe sono invertite
nel modello ΛCDM piatto documentato (H0=70 km/s/Mpc, Ωm=0,3, ΩΛ=0,7), quindi viene applicato il
[tempo di sguardo all’indietro cosmologico](https://arxiv.org/abs/astro-ph/9905116). La scheda mostra
il redshift del modello dedotto e il tipo di distanza usato. Cambia la data di emissione, non la
posizione di catalogo o l’aspetto statico.

È un modello a velocità finita della luce con un’approssimazione cosmologica limitata, non un modello
relativistico completo né di evoluzione galattica. L’estrapolazione del moto uniforme HYG è limitata a ±10.000 anni giuliani e il raggiungimento
del limite viene segnalato.

Il planetario per osservatori terrestri resta una proiezione topocentrica distinta. Usa il luogo
selezionato per altezza, azimut, ostruzione del terreno e dimensione angolare apparente; selezionare
Luce ricevuta non trasforma la mappa 3D in quel planetario.

## Posizioni e rotazioni planetarie

Le posizioni dei pianeti e della Luna sono calcolate localmente con Astronomy Engine. Alcuni corpi
minori e satelliti usano elementi orbitali documentati o fornitori semplificati. La scheda indica il
livello di affidabilità.

I corpi supportati hanno orientamento assiale dipendente dalla data, incluse le rotazioni retrograde.
Allineamento delle texture e dimensione visibile restano adattamenti grafici.

## Esploratore delle eclissi

L’esploratore copre le famiglie di eclissi solari e lunari del sistema Terra–Luna. Può spostare la
simulazione su un evento, mettere a fuoco i corpi e calcolare le circostanze locali per un luogo
francese predefinito o per coordinate inserite manualmente. Le coordinate personalizzate restano nel
browser e usano UTC perché non viene chiamato alcun servizio di geocodifica o fuso orario.

Le viste solari mostrano classificazione parziale, anulare o totale, geometria Luna–Terra–Sole, area
di penombra e percorso centrale colorati. Mostrano anche C1, C2, massimo, C3 e C4, segnalando i
contatti sotto l’orizzonte. C2 e C3 esistono solo quando il luogo raggiunge la totalità o
l’anularità. Le viste lunari rappresentano la Luna che entra nell’ombra terrestre.

::: warning Interpretazione
La scena orbitale esagera alcuni raggi e separazioni per leggibilità. Le sovrapposizioni sulla
superficie sono ricostruzioni educative, non previsioni operative. Per osservare, consulta sempre un
servizio autorevole e le istruzioni di sicurezza per gli occhi.
:::

Le estrapolazioni lunghe, le ricostruzioni storiche e i tempi cosmologici sono segnalati come
estrapolati, simulati o illustrativi anziché presentati come osservazioni esatte.

Continua con [Affidabilità scientifica](/it/scientific-confidence/).
