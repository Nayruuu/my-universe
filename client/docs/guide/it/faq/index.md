---
title: Domande frequenti
description: Risposte su scala, precisione, oggetti mancanti, eclissi, prestazioni, dati statici e ambito di Universe Map.
---

# Domande frequenti

## Dimensioni e distanze sono fisicamente in scala?

I valori sorgente conservano le unità scientifiche, ma il rendering adatta raggi, luminosità e alcune
distanze tra scale. Una scala fisica globale renderebbe pianeti e stelle invisibili durante gran parte
del viaggio. La scheda indica la modalità di scala visiva.

## Perché la rappresentazione cambia durante lo zoom?

I livelli di dettaglio trasformano una galassia distante da impostore a disco procedurale e infine a
volume limitato di particelle. Le dissolvenze mantengono la continuità e controllano geometria e draw
call.

## Perché mancano alcuni nomi?

Le etichette sono ordinate e gestite contro le collisioni. Aumenta la densità, avvicinati o cerca
l’oggetto. Mostrare tutti i nomi coprirebbe la mappa.

## Posso trovare ogni stella o galassia conosciuta?

No. La mappa usa cataloghi selezionati e suddivisi spazialmente. Ogni record incluso è ricercabile, ma
non si tratta di un database astronomico esaustivo.

## Le superfici degli esopianeti sono reali?

No. Periodo, raggio, massa, metodo di rilevamento e posizione dell’ospite provengono dal catalogo;
colore, terreno, fase, orientamento e orbita ravvicinata sono illustrativi.

## Posso pianificare un’eclissi con la mappa?

Usala per capire la geometria ed esplorare gli eventi. Conferma circostanze locali e sicurezza degli
occhi con un servizio astronomico autorevole.

## Il buco nero usa la vera relatività generale?

No. Applica una distorsione qualitativa a lente sottile allo sfondo, con orizzonte ed emissione
separati. Non è un ray tracer relativistico numerico.

## Serve un backend?

No. Ricerca, tempo, cataloghi, texture, tessere e condivisione URL funzionano nel browser o come file
statici.

## Posso condividere una vista esatta?

Sì. Il pulsante conserva bersaglio, selezione, data, zoom, modalità temporale, qualità e opzioni
principali.

## Come segnalo un errore o contribuisco?

Apri una issue nel [repository GitHub](https://github.com/Nayruuu/my-universe/issues). Per una
correzione scientifica, includi fonte, riferimento, epoca, unità e un valore verificabile.
