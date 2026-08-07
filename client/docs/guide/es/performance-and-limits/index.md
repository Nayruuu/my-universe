---
title: Rendimiento y límites
description: Comprende perfiles gráficos, streaming, lotes GPU, requisitos del navegador, métricas y límites de Universe Map.
---

# Rendimiento y límites

Universe Map busca 60 FPS en un ordenador moderno y 30 FPS en móviles. Mantener un tiempo de
fotograma estable importa más que mostrar todos los puntos a la vez.

## Cómo se limita el renderizado

- estrellas, anfitriones, grupos y estructuras usan lotes GPU de puntos o líneas;
- no se crea un objeto Three.js por cada registro de catálogo grande;
- los índices espaciales cargan solo las teselas útiles para la cámara;
- texturas y materiales detallados llegan cerca de su nivel de detalle;
- los cálculos orbitales se actualizan con menor frecuencia y se interpolan;
- las etiquetas respetan presupuestos de escala, calidad y colisión;
- los efectos volumétricos adaptan muestras y píxeles a la calidad;
- el bucle de renderizado queda fuera de la detección de cambios de Angular.

## Perfiles gráficos

| Perfil | Uso                                               | Reducciones típicas                                               |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------- |
| Bajo   | Teléfonos, portátiles antiguos, ahorro de batería | Menos puntos, texturas pequeñas, volúmenes cortos y menos teselas |
| Medio  | GPU integradas y uso general                      | Densidad y posprocesado equilibrados                              |
| Alto   | Equipos de escritorio recientes                   | Catálogos, texturas, volúmenes y detalle más ricos                |

El perfil nunca cambia las coordenadas científicas.

## Depuración

Añade `?debug=true` para ver FPS, draw calls, triángulos, geometrías, texturas, objetos visibles, marco
de referencia, distancia de cámara, objetivo, Día Juliano y calidad.

```text
https://super-universe.app/es/?debug=true
```

Se requieren JavaScript, WebGL 2, memoria GPU suficiente y eventos de puntero. El catálogo no es
exhaustivo; radios y transiciones se adaptan; el modo observable aún no simula todo el viaje de la
luz; los estudios cosmológicos tienen coberturas diferentes; la ausencia de detección no prueba un
vacío físico; superficies detalladas, tiempo meteorológico real y trazado relativista exacto quedan
fuera del alcance.

Si la navegación se ralentiza, baja la calidad, cierra otras pestañas exigentes y vuelve a un objetivo
conocido. Si falla un conjunto estático, revisa su archivo en el panel de red.

Continúa con [Guía de desarrollo](/es/developers/).
