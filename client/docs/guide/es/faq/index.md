---
title: Preguntas frecuentes
description: Respuestas sobre escalas, precisión, objetos ausentes, eclipses, rendimiento, datos estáticos y alcance de Universe Map.
---

# Preguntas frecuentes

## ¿Los tamaños y distancias están físicamente a escala?

Los valores fuente conservan unidades científicas, pero el renderizado adapta radios, brillo y
algunas distancias entre escalas. Una escala física global haría invisibles planetas y estrellas. La
ficha identifica el modo de escala visual.

## ¿Por qué cambia la representación al hacer zoom?

Los niveles de detalle convierten una galaxia lejana de impostor a disco procedural y luego a volumen
de partículas limitado. Los fundidos mantienen continuidad y controlan geometría y draw calls.

## ¿Por qué faltan algunos nombres?

Las etiquetas se ordenan y evitan colisiones. Aumenta la densidad, acércate o busca el objeto. Mostrar
todos los nombres ocultaría el mapa.

## ¿Puedo encontrar cada estrella o galaxia conocida?

No. Se usan catálogos seleccionados y teselados. Todos sus registros son buscables, pero no forman una
base astronómica exhaustiva.

## ¿Son reales las superficies de exoplanetas?

No. Periodo, radio, masa, método de detección y posición del anfitrión son datos; color, terreno, fase,
orientación y órbita cercana son ilustrativos.

## ¿Puedo planificar una observación de eclipse?

Usa la vista para entender la geometría y explora los eventos, pero confirma circunstancias locales y
seguridad ocular con un servicio astronómico autorizado.

## ¿El agujero negro usa relatividad general real?

No. Aplica una distorsión cualitativa de lente fina al fondo y separa horizonte y emisión. No es un
trazador relativista numérico.

## ¿Necesita backend la aplicación?

No. Búsqueda, tiempo, catálogos, texturas, teselas y URL funcionan en el navegador o como estáticos.

## ¿Puedo compartir una vista exacta?

Sí. El botón conserva objetivo, selección, fecha, zoom, modo temporal, calidad y opciones principales.

## ¿Cómo comunico un error o contribuyo?

Abre una incidencia en el [repositorio GitHub](https://github.com/Nayruuu/my-universe/issues). Para
una corrección científica incluye fuente, marco, época, unidad y un valor verificable.
