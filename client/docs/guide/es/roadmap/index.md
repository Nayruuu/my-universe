---
title: Hoja de ruta
description: Consulta lo que Universe Map ya ha entregado, sus prioridades actuales y el trabajo científico o de rendimiento aplazado deliberadamente.
---

# Hoja de ruta

_Última revisión: 27 de agosto de 2026._

Esta página es la hoja de ruta pública de referencia de Universe Map. Describe resultados y criterios
de validación en lugar de prometer fechas. La precisión científica, una navegación legible, tiempos de
fotograma estables y una arquitectura web completamente estática limitan cada evolución.

## Cómo interpretar los estados

| Estado    | Significado                                                            |
| --------- | ---------------------------------------------------------------------- |
| Entregado | Disponible en la aplicación actual y cubierto por pruebas automáticas  |
| Actual    | Próximas mejoras de la experiencia existente                           |
| Después   | Trabajo que requiere antes un contrato científico o mediciones físicas |
| Aplazado  | Útil solo cuando existan nuevas fuentes, datos o un catálogo más denso |

## Entregado

- El **planetario para observadores terrestres** ofrece un cielo HYG de 10.000 estrellas, orientación
  libre, constelaciones modernas, altitud y acimut, campo de visión de 102° a 2° anclado al puntero,
  461 lugares restaurables desde la URL, geolocalización del navegador consentida y redondeada a
  tres decimales, y contextos de escena locales ilustrativos.
- Cada lugar fijo del catálogo dispone de un perfil de obstrucción de 360° calculado con el producto
  autorizado de relieve superficial NOAA/NCEI ETOPO 2022 v1 de 60 segundos de arco. Los perfiles
  compactos se cargan bajo demanda y pueden ocultar estrellas, la Luna y planetas tras el terreno
  modelado; edificios, vegetación, microrrelieve y coordenadas libres quedan fuera del modelo. Tres
  envolventes de distancia calculadas (0–30, 30–100 y 100–300 km) dan profundidad a la silueta; el
  color y la iluminación son estilísticos.
- La Luna y los siete planetas visibles reutilizan sus objetos Three.js, materiales, iluminación y
  texturas diferidas. Se calculan dirección topocéntrica y diámetro angular; el tamaño mínimo de
  legibilidad sigue marcado como ilustrativo.
- Las estrellas y la Vía Láctea ganan detalle de forma continua con el zoom. La navegación también
  elimina objetivos y selecciones que ya no pertenecen al contexto visible.
- Las velocidades cartesianas J2000 de HYG propagan ahora el catálogo compartido, el cielo del
  observador y las figuras de constelación, con confianza extrapolada explícita y límite de ±10.000
  años julianos.
- El modo temporal **Luz recibida** trata ahora la fecha elegida como fecha de recepción. Retrocede el
  Sol, la Luna y los planetas desde la Tierra con Astronomy Engine y resuelve una fecha retardada
  propia para cada estrella HYG desde el baricentro del Sistema Solar. Las rotaciones axiales
  compatibles usan esa fecha de emisión, las fichas muestran retardo y fecha de emisión, y el modelo
  HYG conserva su límite explícito de ±10.000 años julianos.
- Las lunas galileanas usan Astronomy Engine en su fecha recibida desde la Tierra. Los demás
  satélites, planetas enanos, asteroides y cometas documentados resuelven iterativamente el tiempo de
  viaje geométrico con sus elementos JPL de dos cuerpos; la confianza sigue siendo extrapolada y la
  amplificación visual de distancias queda fuera del cálculo científico.
- Los sistemas exoplanetarios documentados comparten ahora un retardo baricéntrico derivado de la
  distancia de la estrella publicada por NASA. La dirección estática de la estrella no cambia y cada
  órbita planetaria local se evalúa en esa fecha de emisión, pero su fase sigue siendo explícitamente
  ilustrativa; los sistemas sin distancia publicada permanecen simultáneos.
- Muros publicados, cuencas probabilísticas, atractores y repulsores conservan procedencia y símbolos
  separados de la red de filamentos Tempel.
- Inicio en frío, transición Tempel y estabilidad de recursos y fotogramas tienen benchmarks de
  navegador reproducibles.

## Prioridades actuales

- Definir contratos de luz recibida adecuados para galaxias y estructuras a gran escala. Necesitan
  semántica cosmológica de tiempo retrospectivo y corrimiento al rojo en vez de una distancia dividida
  sin más por la velocidad de la luz.

El planetario sigue siendo una proyección topocéntrica distinta del lugar de observación elegido. El
mapa temporal Luz recibida usa la Tierra para los cuerpos compatibles del Sistema Solar y el
baricentro del Sistema Solar para las estrellas HYG y los sistemas exoplanetarios documentados.

## Próximas inversiones medidas

- Ejecutar los benchmarks de Tempel, inicio, memoria y frecuencia de imagen en dispositivos físicos
  representativos de gama baja, media y alta. Solo se añadirá precompilación de shaders u opciones
  más costosas si esas mediciones lo justifican.

## Aplazado deliberadamente

- La jerarquía estelar agregada preparada seguirá inactiva hasta que un catálogo más denso necesite
  una representación visible entre escalas. Activarla exigirá preparación en Web Worker y ningún
  trabajo invisible de red o GPU.
- Solo se añadirán nuevas siluetas o mallas de cuerpos irregulares cuando un modelo de forma autorizado
  justifique descarga, decodificación, atribución y coste de renderizado.

## Límite del producto

La hoja de ruta no promete un Universo exhaustivo, meteorología en directo, exploración terrestre,
simulación gravitatoria completa ni trazado relativista. Consulta
[Fiabilidad científica](/es/scientific-confidence/) y
[Rendimiento y límites](/es/performance-and-limits/) para conocer el contrato actual.

Siguiente: [Acerca del proyecto](/es/about/).
