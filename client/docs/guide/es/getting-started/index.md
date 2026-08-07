---
title: Primeros pasos
description: Abre Universe Map, conoce su interfaz, elige un perfil gráfico y comparte tu primera vista astronómica.
---

# Primeros pasos

Universe Map funciona por completo en un navegador moderno. No requiere cuenta ni backend de
aplicación. Los catálogos, texturas y modelos son archivos estáticos que se cargan progresivamente
cuando la cámara cambia de escala.

## Abrir el mapa

Visita [super-universe.app](https://super-universe.app/es/). La primera vista carga el motor y un
manifiesto compacto; los conjuntos estelares y galácticos grandes solo se descargan cuando hacen
falta.

Para una buena primera experiencia:

1. usa un navegador de escritorio reciente con WebGL 2;
2. mantén la calidad **Alta** con una GPU moderna;
3. espera a que desaparezca el indicador de carga;
4. desplázate sobre un objeto visible o pulsa su nombre.

También se admite navegación táctil y la densidad visual se reduce automáticamente en dispositivos
pequeños.

## Recorrido por la interfaz

| Zona                | Función                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Búsqueda superior   | Encontrar planetas, lunas, estrellas, exoplanetas, galaxias, agujeros negros, supernovas y grandes estructuras. |
| Ruta de escala      | Mostrar la jerarquía astronómica y acceder directamente a niveles superiores.                                   |
| Ficha del objeto    | Consultar fuentes, alias, propiedades, fiabilidad y acciones de enfoque.                                        |
| Controles flotantes | Zoom, regreso a la Tierra o al Sol e interruptores de órbitas, constelaciones y nombres.                        |
| Línea temporal      | Editar UTC, pausar o reproducir, elegir velocidad y explorar eclipses.                                          |
| Escala del mapa     | Ver una escala visual adaptada al contexto de cámara.                                                           |

## Un primer viaje

1. busca **Tierra** y selecciona el resultado;
2. usa la rueda o el gesto de pinza para alejarte por el Sistema Solar;
3. selecciona **Sol** y sigue hasta el vecindario estelar;
4. elige **Vía Láctea** en el menú de escala;
5. continúa al Grupo Local, Universo cercano y red cósmica;
6. usa la ruta jerárquica para volver al Sistema Solar.

El objetivo lógico define la jerarquía y los límites de distancia, el pivote geométrico define el
centro de órbita y la selección define la ficha. Un enfoque explícito suele alinear los tres, pero el
zoom hacia el puntero y la navegación libre pueden separarlos.

## Observar una estrella desde el horizonte terrestre

Busca una estrella como **Sirio**, abre su ficha y elige **Localizar desde la Tierra**. La vista del
cielo local usa la fecha y el lugar de observación del mapa. Arrastra para mirar alrededor, cambia el
campo de visión con la rueda o un gesto de pinza y usa **Volver a centrar** para recuperar el objetivo.
Son controles de planetario: mientras la vista Horizonte está abierta, la rueda no activa cambios
semánticos de escala ni desplazamiento a la distancia mínima. El selector ofrece 461 lugares de
observación estáticos de todo el mundo; el observador y la vista de planetario se conservan en los
enlaces compartidos. **Usar mi ubicación** solicita permiso al navegador solo al seleccionarlo,
redondea las coordenadas obtenidas a tres decimales (unos 100 m) y usa después el mismo contrato de
observador compartible.

La Luna y los planetas visibles reutilizan los mismos objetos Three.js, materiales, iluminación y
texturas documentadas o adaptadas de la vista de mapa. Sus direcciones topocéntricas y diámetros
angulares se calculan para el lugar y el instante elegidos. Un tamaño mínimo limitado mantiene
legibles los planetas pequeños y se marca explícitamente como ilustrativo, no como tamaño angular real.

El horizonte sigue el acimut de la mirada y permanece unido al suelo mientras el cielo sigue el
tiempo. Ocho ciudades destacadas tienen contextos visuales compuestos a mano; cada lugar del catálogo
carga bajo demanda cuatro hitos cercanos desde paquetes regionales estáticos. Que un nombre, una
coordenada o una altura estén documentados no convierte el dibujo en una medición: terreno, luces,
capas urbanas y siluetas genéricas son explícitamente ilustrativos. La vista no sustituye un perfil de
obstáculos topográficos medido, datos meteorológicos, una reconstrucción histórica ni una herramienta
profesional de planificación.

## Calidad y enlaces compartidos

- **Baja** reduce partículas, texturas, volúmenes y teselas;
- **Media** equilibra detalle y coste de GPU;
- **Alta** activa la representación más rica prevista en la escala actual.

La calidad no cambia coordenadas ni fiabilidad. El botón de compartir conserva objetivo, selección,
fecha, zoom, modo temporal, calidad, densidad de nombres, órbitas, constelaciones y etiquetas. La URL
se actualiza con un pequeño retraso, no en cada fotograma.

Continúa con [Navegación y escalas](/es/navigation/).
