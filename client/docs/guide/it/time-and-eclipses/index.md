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

**Vista osservabile** è riservata a una rappresentazione che consideri il tempo di viaggio della luce
da una posizione di osservazione. L’architettura la distingue, ma il prototipo non offre ancora un
modello relativistico completo a tutte le scale.

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
