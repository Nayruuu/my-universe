---
title: Tiempo y eclipses
description: Comprende el tiempo UTC, las velocidades, las efemérides planetarias, la rotación axial y los eclipses en Universe Map.
---

# Tiempo y eclipses

La línea temporal controla internamente un Día Juliano numérico. La interfaz acepta una fecha civil
UTC y la convierte antes de enviarla al motor de renderizado.

## Controles temporales

Puedes introducir fecha y hora UTC, reproducir o pausar, volver al presente, elegir un multiplicador
apropiado para la escala y explorar eclipses pasados y futuros documentados. En pausa, las posiciones
orbitales y la rotación axial permanecen fijas. Al reanudar, ambas derivan del mismo tiempo interno y
no del número de fotogramas.

## Modos temporales

**Estado en la fecha elegida** muestra el estado estimado de los objetos en un instante común y es el
modo principal implementado.

**Luz recibida** trata la fecha elegida como fecha de recepción. Los cuerpos compatibles del Sistema
Solar se observan desde la Tierra y las estrellas HYG desde el baricentro del Sistema Solar. Cada
objeto compatible se calcula en su propia fecha de emisión; su rotación axial usa esa misma fecha. La
ficha muestra el tiempo de viaje de la luz calculado y la fecha de emisión.

El modo cubre actualmente el Sol, la Luna, los planetas, las lunas galileanas, satélites de dos
cuerpos documentados, planetas enanos, asteroides, cometas, estrellas HYG y sistemas exoplanetarios
con una distancia publicada de la estrella anfitriona. Los cuerpos de Astronomy Engine conservan una
confianza calculada. Los demás objetos del Sistema Solar resuelven iterativamente su retardo recibido
desde la Tierra con los mismos elementos medios u osculadores JPL que usa el mapa; el resultado sigue
marcado explícitamente como extrapolado. La amplificación visual de distancias nunca interviene en el
cálculo.

En un sistema exoplanetario, la
[distancia de sistema de NASA PSCompPars](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
define un retardo baricéntrico común para la estrella y sus planetas según la
[definición del pársec de la UAI](https://www.iau.org/static/resolutions/IAU2015_English.pdf). La
dirección estática de la estrella no cambia porque esta capa no reconstruye su movimiento propio. Las
órbitas planetarias locales se evalúan en la fecha de emisión común, pero su fase, orientación y
escala visual siguen siendo explícitamente ilustrativas. Los sistemas sin distancia publicada
permanecen simultáneos.

Las galaxias cercanas con distancia de catálogo usan su tiempo de viaje geométrico sin mover la
posición 3D estática. Los módulos de distancia de Cosmicflows-4 se interpretan como distancias de
luminosidad y las distancias visuales de las estructuras a gran escala como distancias comóviles.
Ambas se invierten con el mismo modelo ΛCDM plano documentado (H0=70 km/s/Mpc, Ωm=0,3, ΩΛ=0,7) y
se aplica el [tiempo retrospectivo cosmológico](https://arxiv.org/abs/astro-ph/9905116). La ficha
muestra el corrimiento al rojo inferido y el tipo de distancia utilizado. Cambia la fecha de emisión,
no la posición de catálogo ni la apariencia estática.

Es un modelo con velocidad finita de la luz y una aproximación cosmológica acotada, no un modelo
relativista completo ni de evolución galáctica. La extrapolación del movimiento uniforme HYG está limitada a ±10.000 años julianos y se
indica al alcanzar ese límite.

El planetario para observadores terrestres sigue siendo una proyección topocéntrica distinta. Usa el
lugar elegido para altitud, acimut, ocultación por el terreno y tamaño angular aparente; seleccionar
Luz recibida no convierte el mapa 3D en ese planetario.

## Posiciones y rotaciones

Las posiciones de planetas y Luna se calculan localmente con Astronomy Engine. Algunos cuerpos
menores y satélites usan elementos orbitales documentados o proveedores simplificados. La ficha
indica la fiabilidad correspondiente.

Los cuerpos compatibles emplean orientación axial dependiente de la fecha, incluidas rotaciones
retrógradas. La alineación de texturas y el tamaño visible siguen siendo adaptaciones gráficas.

## Explorador de eclipses

El explorador cubre eclipses solares y lunares del sistema Tierra–Luna. Puede trasladar la simulación
a un evento, enfocar los cuerpos y calcular circunstancias locales para un lugar francés predefinido
o para coordenadas introducidas manualmente. Las coordenadas personalizadas permanecen en el
navegador y usan UTC porque no se llama a ningún servicio de geocodificación ni de zona horaria.

Las vistas solares distinguen eclipses parciales, anulares y totales, la geometría Luna–Tierra–Sol,
la penumbra y la trayectoria central. También muestran C1, C2, máximo, C3 y C4, e identifican los
contactos bajo el horizonte. C2 y C3 solo existen si el lugar alcanza la totalidad o la anularidad.
Las vistas lunares muestran la Luna entrando en la sombra terrestre.

::: warning Interpretación
La escena orbital exagera algunos radios y separaciones para ser legible. Las capas de superficie son
reconstrucciones educativas, no previsiones operativas. Para observar, consulta un servicio oficial y
las instrucciones de protección ocular.
:::

Las extrapolaciones largas, reconstrucciones históricas y fechas cosmológicas se marcan como
extrapoladas, simuladas o ilustrativas.

Continúa con [Fiabilidad científica](/es/scientific-confidence/).
