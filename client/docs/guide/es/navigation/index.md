---
title: Navegación y escalas
description: Aprende los controles de cámara, el zoom semántico, los marcos de referencia, los objetivos y las transiciones de Universe Map.
---

# Navegación y escalas

Universe Map funciona como un mapa espacial, no como un diagrama orbital fijo. La velocidad de la
cámara, la distancia mínima, las etiquetas, las representaciones y los fondos se adaptan al contexto.

## Controles

| Acción                         | Escritorio                          | Táctil                           |
| ------------------------------ | ----------------------------------- | -------------------------------- |
| Orbitar alrededor del objetivo | Clic izquierdo y arrastrar          | Arrastrar con un dedo            |
| Desplazar                      | Clic derecho y arrastrar            | Arrastrar con dos dedos          |
| Zoom hacia el puntero          | Rueda del ratón                     | Pellizcar                        |
| Seleccionar                    | Clic en el objeto o su nombre       | Tocar el objeto o su nombre      |
| Enfocar                        | Doble clic, clic en un nombre o `F` | Doble toque o toque en un nombre |
| Reproducir o pausar            | `Espacio`                           | Botón de la línea temporal       |
| Cambiar velocidad              | `+` o `-`                           | Selector de la línea temporal    |
| Cerrar la ficha                | `Escape`                            | Botón Cerrar                     |

El zoom sigue el puntero. Sin objetivo, la cámara aún avanza hacia el punto situado bajo el cursor.
Cerca de un cuerpo, los límites evitan atravesar por accidente su superficie visible.

## Las siete escalas

| Escala             | Contenido típico                                          | Representación principal                         |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| Planetaria         | Superficie, atmósfera, anillos, lunas                     | Mallas y texturas detalladas                     |
| Sistema Solar      | Sol, planetas, cuerpos menores, órbitas                   | Mallas adaptativas, etiquetas y trayectorias     |
| Vecindario estelar | Estrellas HYG, anfitriones de exoplanetas, constelaciones | Lotes de puntos GPU y detalle seleccionado       |
| Vía Láctea         | Disco, bulbo, brazos y posición local                     | Volumen emisivo por capas y contexto de catálogo |
| Grupo Local        | Vía Láctea, Andrómeda y satélites                         | Impostores galácticos y volúmenes limitados      |
| Universo cercano   | Galaxias y grupos del volumen local                       | Teselas espaciales y lotes panorámicos           |
| Red cósmica        | Grupos, cúmulos, vacíos y filamentos                      | Puntos, líneas y volumen de densidad simulado    |

La transición es continua, aunque cada escala usa un marco interno distinto. El motor recentra las
coordenadas alrededor de la cámara para mantener la precisión.

## Objetivo, selección y etiquetas

El **objetivo** es el pivote de cámara, la **selección** alimenta la ficha y una **etiqueta** es una
anotación de pantalla gestionada contra solapamientos. Pulsar una etiqueta selecciona y centra el
objeto. La densidad puede ser mínima, equilibrada o densa, dando prioridad al objetivo, la selección y
los grandes hitos. El Sol permanece como referencia local y la Vía Láctea toma el relevo a mayor
escala.

El menú de escala permite saltos directos con la misma interpolación que la búsqueda. Si una vista
parece vacía, revisa la escala, activa nombres, usa densidad equilibrada o densa, selecciona el Sol o
la Vía Láctea, o baja la calidad en un dispositivo lento.

Continúa con [Tiempo y eclipses](/es/time-and-eclipses/).
