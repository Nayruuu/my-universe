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

## Estado de las mediciones físicas

Una medición repetida del 27 de agosto de 2026 utilizó un MacBook Pro de gama alta con Apple M5 Max,
macOS 26.6, Chrome 151, el renderer Metal real, calidad escritorio/alta y relación de píxeles 1. En
tres pasadas, la mediana del primer mapa utilizable fue de 259,3 ms y la del primer fotograma visible
de Tempel de 7,1 ms. Tres recorridos en frío se mantuvieron en 9,1–9,2 ms en p95, 16,7 ms en p99,
66,6–75 ms como máximo y 0,24–0,36 % de fotogramas largos. Tras tres calentamientos, tres ciclos se
mantuvieron en 100 geometrías, 18 texturas y 44 draw calls; el heap recogido bajó 0,77 MiB.

Un perfil independiente del planetario observable solicitó DPR 2 al navegador con 1440 × 900 píxeles
CSS. El renderer en calidad alta aplicó su límite documentado de DPR 1,5 y permaneció estable en las
tres pasadas. Cada una muestreó 1452–1455 fotogramas con 9,1 ms en p95, 9,3 ms en p99,
9,4–9,5 ms de máximo y ningún fotograma largo; Júpiter alcanzó su representación resuelta en las tres.

Una matriz de estrés en el mismo equipo, marcada explícitamente como simulada, también se mantuvo
dentro del presupuesto. Con calidad media, CPU de Chrome ralentizada 4× y DPR 1,25 del canvas, las
medianas fueron 9,3 ms en p95, 16,7 ms en p99 y 24,9 ms de máximo, sin fotogramas largos. Con calidad
baja, CPU 6× y DPR 1, fueron 15,9 ms en p95, 25,1 ms en p99 y 42 ms de máximo, con un peor fotograma
de 49,9 ms y 0,20–0,34 % de fotogramas largos. Júpiter se resolvió en las seis pasadas bajo estrés.
La GPU siguió siendo la M5 Max, así que estos datos miden margen frente a regresiones, no hardware
físico representativo de gama media o baja.

Los cinco benchmarks de rendimiento — inicio, Tempel, recursos, fotogramas entre escalas y planetario
observable — pueden escribir el mismo informe de evidencia JSON versionado mediante
`UNIVERSE_BENCHMARK_REPORT_PATH`. Conserva la revisión Git y el estado dirty, las características del
equipo, el navegador y renderer WebGL, la configuración, las muestras y el resumen.
`UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL=1` rechaza ralentización de CPU, rendering por software o la
ausencia de una `UNIVERSE_BENCHMARK_DEVICE_CLASS` declarada antes de escribir el informe, de modo que
una simulación no puede entrar silenciosamente en la matriz física.

`npm run benchmark:campaign` ejecuta los cinco protocolos de forma secuencial en un equipo físico
representativo. Exige un checkout Git limpio y una clase y etiqueta declaradas, desactiva la
ralentización de CPU, aplica presupuestos estrictos y al menos tres repeticiones, y usa por defecto la
calidad correspondiente a la clase. Escribe cinco informes fuera del repositorio y un manifiesto
`universe-map/performance-campaign@1` que los vincula mediante huellas SHA-256. El comando empaqueta
evidencia comparable; no convierte un equipo en otra clase.

`npm run benchmark:campaign:simulated` ofrece una campaña de estrés separada en el mismo equipo
cuando no hay hardware representativo. La ralentización de CPU de Chrome se aplica a los cinco
protocolos: calidad media a 4× con DPR de observador 1,25 y calidad baja a 6× con DPR 1. Los diez
benchmarks siguen siendo secuenciales y, desde un checkout limpio, generan un manifiesto
`universe-map/simulated-performance-campaign@1` con huellas SHA-256 y límites explícitos. GPU,
memoria gráfica, controlador, ancho de banda de memoria y comportamiento térmico siguen siendo los
del equipo de origen; media y baja son proxies de regresión, nunca evidencia de dispositivos físicos.

La referencia física repetida sigue documentando solo la gama alta. Las mediciones físicas de gama
media y baja pasan a ser una comprobación futura opcional, no un bloqueo cuando falta el hardware.

## Depuración

Añade `?debug=true` para ver FPS, draw calls, triángulos, geometrías, texturas, objetos visibles, marco
de referencia, distancia de cámara, objetivo, Día Juliano y calidad.

```text
https://super-universe.app/es/?debug=true
```

Se requieren JavaScript, WebGL 2, memoria GPU suficiente y eventos de puntero. El catálogo no es
exhaustivo; radios y transiciones se adaptan; Luz recibida corrige los cuerpos compatibles del Sistema
Solar — incluidas lunas galileanas, satélites simplificados, planetas enanos, asteroides y cometas — y
las estrellas HYG por el tiempo de viaje de la luz; los sistemas exoplanetarios documentados comparten
un retardo derivado de la distancia publicada de su estrella, aunque las fases planetarias locales
siguen siendo ilustrativas y los sistemas sin distancia permanecen simultáneos; las galaxias cercanas
usan el tiempo geométrico de la distancia de catálogo; las distancias de luminosidad Cosmicflows-4 y
comóviles de las grandes estructuras usan un corrimiento al rojo inferido
y el tiempo retrospectivo ΛCDM; sus posiciones, formas y medidas permanecen estáticas;
los estudios cosmológicos tienen coberturas diferentes; la ausencia de detección no prueba un
vacío físico; superficies detalladas, tiempo meteorológico real y trazado relativista exacto quedan
fuera del alcance.

Si la navegación se ralentiza, baja la calidad, cierra otras pestañas exigentes y vuelve a un objetivo
conocido. Si falla un conjunto estático, revisa su archivo en el panel de red.

Continúa con [Guía de desarrollo](/es/developers/).
