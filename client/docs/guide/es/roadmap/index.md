---
title: Hoja de ruta
description: Consulta lo que Universe Map ya ha entregado, sus prioridades actuales y el trabajo científico o de rendimiento aplazado deliberadamente.
---

# Hoja de ruta

_Última revisión: 11 de septiembre de 2026._

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
- El regreso del planetario al mapa 3D dura 2,4 segundos en el mismo renderer, conserva la
  mirada inicial y convierte la Tierra en pivote. Cualquier gesto interrumpe la animación
  ilustrativa, que respeta la preferencia de movimiento reducido.
- Fichas, búsqueda, planificador y línea temporal se adaptan a pantallas estrechas y bajas,
  con estados compactos y ampliados. El cierre queda en la cabecera y la acción orbital junto
  a los datos de órbita. Se elimina el aviso naranja redundante, pero permanece el contexto
  científico. Las pruebas de rueda esperan a que termine la inercia y verifican un nuevo gesto
  en el límite de distancia, sin cambiar los controles de cámara.
- Un planificador local bajo demanda ordena la Luna, los planetas y los satélites catalogados visibles
  por altitud y evalúa las 48 estrellas más brillantes del catálogo para proponer hasta ocho visibles.
  Elegir una sugerencia abre sus detalles existentes y vuelve a centrar el cielo. Se aplican el
  horizonte calculado y la obstrucción del relieve cuando están disponibles. El objetivo activo ahora
  dispone de una curva de altitud calculada de 24 horas con salida, culminación, puesta, franjas de
  crepúsculo USNO, interferencia lunar, un índice de mejor ventana explícitamente ilustrativo y una
  acción que mueve juntos el tiempo y la cámara. El objetivo de la curva puede cambiarse desde el mismo
  catálogo local sin mover el cielo actual; solo esa acción confirma el objetivo, el tiempo compartido
  y la cámara. Una comparación compacta aplica el mismo cálculo a siete noches consecutivas. Destaca
  automáticamente la mejor con un índice ilustrativo comparable sobre 100 y muestra altura,
  oscuridad, luz lunar y despeje del terreno antes de su acción directa al mejor instante, refinado
  localmente a cinco minutos. El tiempo en directo, la contaminación lumínica y los obstáculos locales
  no medidos quedan fuera del modelo.
- Cada lugar fijo del catálogo dispone de un perfil de obstrucción de 360° calculado con el producto
  autorizado de relieve superficial NOAA/NCEI ETOPO 2022 v1 de 60 segundos de arco. Los perfiles
  compactos se cargan bajo demanda y pueden ocultar estrellas, la Luna, planetas y satélites tras el terreno
  modelado; edificios, vegetación, microrrelieve y coordenadas libres quedan fuera del modelo. Tres
  envolventes de distancia calculadas (0–30, 30–100 y 100–300 km) dan profundidad a la silueta; el
  color y la iluminación son estilísticos.
- La Luna, los siete planetas visibles y otros veinte satélites catalogados reutilizan sus objetos
  Three.js, materiales, iluminación y texturas diferidas. Las direcciones topocéntricas y los diámetros
  angulares usan distancias orbitales físicas: las posiciones galileanas son calculadas y las otras
  dieciséis trayectorias de elementos medios J2000 siguen marcadas como extrapoladas. Los satélites
  aparecen a partir de un campo de 12°, o de inmediato si son el objetivo, para evitar superposiciones
  en gran angular; el tamaño mínimo de legibilidad sigue marcado como ilustrativo.
- La vista exterior y el recorrido de la Vía Láctea usan la misma nube galactocéntrica fija,
  sin imagen de galaxia ni túnel ligado a la cámara. Disco y Sol comparten la escala canónica:
  100.000 años luz de diámetro y 8,178 kpc del Sol al centro. No cambian el recorrido de cámara
  ni la respuesta de la rueda. Los granos finos muestran paralaje de perspectiva y un lote GPU
  adicional acotado aporta detalle cercano. Barra dorada, núcleo marfil, brazos blancoazulados y
  bandas oscuras son densidades y colores ilustrativos, no mediciones Gaia individuales ni luz
  emitida por el agujero negro.
- El marco local se despliega de forma invisible entre 3.600 y 2.400 unidades de escena.
  HYG/Gaia aparecen entre 900 y 90 unidades con sus coordenadas ya fijas. La nube galáctica
  desaparece entre 220 y 70, mientras planetas y órbitas aparecen entre 240 y 90. El detalle
  cercano conserva su posición al detenerse y al recorrer el camino inverso.
- Las galaxias externas también usan nubes fijas con densidad espiral, elíptica o irregular,
  visibles desde varios ángulos. Las posiciones de catálogo se conservan; puntos internos y
  colores son ilustrativos. Seleccionar una galaxia conserva su ficha y las interacciones,
  sin superponer un enorme anillo de selección planetario.
- Una jerarquía Gaia DR3 representa 2.923.790 fuentes filtradas por calidad mediante agregados
  calculados distantes de 512 pc y 133.526 muestras de fuentes medidas para la vista general del
  vecindario estelar. Cada hoja refinada de 512 pc conserva sus 32 fuentes más brillantes y una
  selección uniforme determinista, hasta 96 puntos. El refinamiento limitado por visibilidad y
  calidad carga solo las ramas útiles, las valida en Workers de módulo, transfiere arrays tipados
  sin copias y nunca crea un objeto Three.js por fuente. Las muestras Gaia conservadas mantienen su
  identificador de fuente y se pueden seleccionar y enfocar directamente desde sus lotes GPU
  compartidos; sus fichas muestran G y BP−RP medidos y la distancia calculada por inversión de
  paralaje. Siguen fuera de la búsqueda global y las etiquetas, mientras que las celdas agregadas
  permanecen anónimas. El campo muestreado es incompleto. Al alejar
  el zoom, las muestras detalladas se funden en raíces calculadas que siguen visibles de forma
  discreta hasta el Grupo Local, mientras el volumen local se integra en el disco de la Vía Láctea
  mediante una escala logarítmica.
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
  explícitamente sigue cargándose de inmediato. La campaña limpia del 28 de agosto de 2026, revisión `27db0e1`, superó sus diez
  informes. Los recorridos de escala media/CPU 4× se mantienen en 9,3 ms p95 con un peor fotograma de
  66,5 ms; baja/CPU 6× se mantiene en 16,6–16,7 ms p95 con un peor fotograma de 83,4 ms. Los recorridos
  observables resuelven Júpiter 3/3 en ambos perfiles y los recuentos de recursos no derivan.

## Completado el 11 de septiembre de 2026

- Entregadas las mejoras CPU y de catálogos: preparación por lotes, cachés de búsqueda y etiquetas,
  publicación completa y cálculo de ancestros una vez por fotograma. El panorama 8K se decodifica
  de forma asíncrona con precalentamiento limitado. Cámara, coordenadas y valores científicos no cambian.
- La campaña limpia sobre `796fe70` supera **10/10** presupuestos de protocolo/perfil, con tres
  recorridos o ciclos por caso: medium/CPU 4× y low/CPU 6×. Medianas Tempel: 27,2 / 29,9 ms;
  los seis primeros fotogramas quedan bajo 33,3 ms. Máximos de escala: 100,0 / 66,7 ms.
  Sin deriva en recursos; Júpiter resuelto 3/3 por perfil. Termina esta campaña, no todos los
  posibles picos. La limitación CPU conserva la GPU y memoria del equipo original.
- Correcciones de seguridad entregadas en `c380bce`: npm audit sin vulnerabilidades el
  11 de septiembre y verificación completa superada, incluidos 180 tests de navegador y cobertura
  del 100 %. El 14 de septiembre, la API Dependabot de GitHub no devolvía ninguna alerta abierta. La campaña de rendimiento es anterior
  a estas actualizaciones y no corresponde a `c380bce`.

## Prioridades actuales

1. Validar juntos brazos, núcleo, halo y sensación de recorrido frente a las referencias.
   Visibilidad técnica no significa aprobación estética; no modificar la cámara.
2. Vigilar el primer trabajo GPU y los picos. Medium alcanza el límite de 100 ms; el pico aislado
   Tempel de 78,2 ms no se reprodujo después, pero no está demostrado que esté corregido.
3. Repetir la campaña limpia tras actualizar dependencias antes de declarar una nueva referencia
   de rendimiento.
4. La validación física en equipos medios/bajos sigue siendo opcional según disponibilidad.

El planetario sigue siendo una proyección topocéntrica distinta del lugar de observación elegido. El
mapa temporal Luz recibida usa la Tierra para los cuerpos compatibles del Sistema Solar y el
baricentro del Sistema Solar para las estrellas HYG y los sistemas exoplanetarios documentados.

## Aplazado deliberadamente

- Solo se añadirán nuevas siluetas o mallas de cuerpos irregulares cuando un modelo de forma autorizado
  justifique descarga, decodificación, atribución y coste de renderizado.

## Límite del producto

La hoja de ruta no promete un Universo exhaustivo, meteorología en directo, exploración terrestre,
simulación gravitatoria completa ni trazado relativista. Consulta
[Fiabilidad científica](/es/scientific-confidence/) y
[Rendimiento y límites](/es/performance-and-limits/) para conocer el contrato actual.

Siguiente: [Acerca del proyecto](/es/about/).
