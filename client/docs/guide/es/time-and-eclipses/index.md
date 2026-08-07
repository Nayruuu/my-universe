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

**Vista observable** queda reservado para una representación que considere el tiempo de viaje de la
luz desde un observador. La arquitectura lo distingue, pero el prototipo aún no ofrece un modelo
relativista completo en todas las escalas.

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
