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

El objetivo define el pivote de cámara y la selección define la ficha. Suelen coincidir después de una
búsqueda o un clic, pero pueden separarse durante la navegación libre.

## Calidad y enlaces compartidos

- **Baja** reduce partículas, texturas, volúmenes y teselas;
- **Media** equilibra detalle y coste de GPU;
- **Alta** activa la representación más rica prevista en la escala actual.

La calidad no cambia coordenadas ni fiabilidad. El botón de compartir conserva objetivo, selección,
fecha, zoom, modo temporal, calidad, densidad de nombres, órbitas, constelaciones y etiquetas. La URL
se actualiza con un pequeño retraso, no en cada fotograma.

Continúa con [Navegación y escalas](/es/navigation/).
