---
title: Hoja de ruta
description: Consulta lo que Universe Map ya ha entregado, sus prioridades actuales y el trabajo científico o de rendimiento aplazado deliberadamente.
---

# Hoja de ruta

_Última revisión: 28 de agosto de 2026._

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
- Las galaxias cercanas usan ahora el tiempo geométrico de su distancia de catálogo. Los módulos de
  distancia Cosmicflows-4 se tratan como distancias de luminosidad y las distancias cartográficas de
  las grandes estructuras como distancias comóviles; ambas se invierten en el modelo ΛCDM plano
  documentado. Las fichas muestran el corrimiento al rojo inferido y el tiempo retrospectivo, mientras
  posiciones y apariencias estáticas no cambian y el resultado se marca como extrapolado.
- Muros publicados, cuencas probabilísticas, atractores y repulsores conservan procedencia y símbolos
  separados de la red de filamentos Tempel.
- Inicio en frío, transición Tempel y estabilidad de recursos y fotogramas tienen benchmarks de
  navegador reproducibles.
- Una referencia física repetida de gama alta documenta tres pasadas de inicio, Tempel y fotogramas
  en frío, además de tres ciclos de recursos tras calentamiento en un Apple M5 Max con su renderer
  Metal real. No es evidencia de otra clase de dispositivo.
- Un benchmark dedicado al planetario observable cubre el desplazamiento real del cielo, el
  recentrado, la transición anclada en Júpiter hacia el planeta resuelto compartido y el alejamiento.
  Tres pasadas físicas Retina de gama alta superaron el límite DPR 1,5 de calidad alta sin
  fotogramas largos. Una matriz separada de estrés CPU 4×/6×, explícitamente simulada, también pasa
  y solo mide margen frente a regresiones.
- Los cinco protocolos manuales de rendimiento comparten ahora un informe de evidencia JSON
  versionado que conserva el estado del código, equipo, renderer, configuración, muestras y resumen.
  Un control físico rechaza medidas simuladas, renderizadas por software o sin clasificar antes de
  escribir el informe. Un ejecutor de campaña con checkout limpio los lanza secuencialmente y vincula
  los cinco archivos en un manifiesto verificable mediante SHA-256.
- Un comando separado con checkout limpio ejecuta ahora la campaña de regresión media y baja en el
  mismo equipo para los cinco protocolos: calidad media con CPU 4× y calidad baja con CPU 6×. Su
  manifiesto simulado independiente vincula diez informes y declara que GPU, memoria, controlador,
  ancho de banda y comportamiento térmico siguen perteneciendo al equipo de origen.
- Los cuatro catálogos complementarios se descargan y decodifican ahora en un Worker de módulo
  dedicado, y sus búferes tipados se transfieren sin copia. La preparación no crea recursos de
  escena; al terminar, la instalación en el hilo principal de registros, búsqueda, geometrías y GPU
  exige una nueva ventana de 1,2 segundos de cámara estable. Cada transición reinicia el plazo, el
  modo observable suspende por completo la instalación de fondo y un objetivo solicitado
  explícitamente sigue cargándose de inmediato. La campaña limpia de la revisión ya supera sus diez
  informes. Los recorridos de escala media/CPU 4× se mantienen en 9,3 ms p95 con un peor fotograma de
  66,5 ms; baja/CPU 6× se mantiene en 16,6–16,7 ms p95 con un peor fotograma de 83,4 ms. Los recorridos
  observables resuelven Júpiter 3/3 en ambos perfiles y los recuentos de recursos no derivan.

## Prioridades actuales

- Mantener el manifiesto simulado limpio aprobado 10/10 como referencia de regresión y repetir la
  campaña tras cambios importantes de renderizado o catálogo. La evidencia actual no justifica una
  ruta de precompilación de shaders más pesada ni un fallback de menor fidelidad; la validación física
  media/baja sigue siendo opcional si aparece hardware adecuado. Los perfiles simulados siguen siendo
  controles de regresión, no afirmaciones sobre dispositivos.

El planetario sigue siendo una proyección topocéntrica distinta del lugar de observación elegido. El
mapa temporal Luz recibida usa la Tierra para los cuerpos compatibles del Sistema Solar y el
baricentro del Sistema Solar para las estrellas HYG y los sistemas exoplanetarios documentados.

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
