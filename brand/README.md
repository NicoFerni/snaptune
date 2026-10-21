# SnapTune: kit de marca

Todo lo necesario para mostrar SnapTune en cualquier lado: logo, colores, tipografías, capturas, video
e imágenes para redes. Lo que está en `logo/` en SVG es la fuente; los PNG salen de ahí.

| Carpeta | Qué tiene |
| --- | --- |
| `logo/` | El logo completo (baldosa + SNAPTUNE), la baldosa sola en varios tamaños y el signo ¢ solo, sin fondo |
| `colors/` | La lámina de colores (`palette.png`) y los mismos colores en `palette.css` y `palette.json` |
| `fonts/` | Rokkitt y Literata, con sus licencias |
| `screenshots/` | La ventana del plugin entera (Studio, Live y Hard Tune) y cinco detalles |
| `video/` | El promo de 30 s con sonido y el loop mudo de la tapa del sitio (no están en git: se renderizan desde `promo/`) |
| `social/` | Avatar, portada de X y la imagen que aparece al compartir el link del sitio |

## Logo

La marca es un signo de centavo dibujado como un afinador: el arco abierto hacia la derecha y la aguja
que lo atraviesa. SnapTune mide en cents y no cuesta ninguno.

- `snaptune-logo-gold`: sobre verde o fondos oscuros. `snaptune-logo-green`: sobre dorado o fondos claros.
- `snaptune-icon`: la baldosa dorada, para íconos y favicons. `-inverted` es la versión verde.
- `snaptune-mark-*`: el ¢ solo, sin fondo.
- No lo recolores fuera de la paleta, no lo estires ni lo rotes, y no le agregues sombras, brillos ni
  degradés. Dejale alrededor un margen de al menos un cuarto del lado de la baldosa, y no la uses a
  menos de 16 px.

## Colores

| Color | Hex | Para qué |
| --- | --- | --- |
| Verde botella | `#133621` | El fondo: el sitio y la ventana del plugin |
| Dorado | `#f4d96c` | El acento: títulos y texto sobre verde, tarjetas, la nota elegida |
| Marfil | `#efe8cf` | El papel: la carta, el recibo, el dorso de la tarjeta; el texto del plugin |
| Superficie | `#1a4429` | Un tono más claro que el fondo, para separar una sección |
| Profundo | `#0e2a19` | Un tono más oscuro: los paneles del plugin |
| Dorado apagado | `#b3a55e` | Texto secundario sobre verde, solo en tamaño de lectura |
| Salvia | `#9cc0a4` | La línea de lo que cantaste, en el afinador y el gráfico |

Siempre colores planos: nada de degradés.

## Tipografías

- **Rokkitt ExtraBold (800), en mayúsculas**: títulos y el nombre.
- **Literata**: todo el texto.
- Las dos tienen la licencia SIL Open Font License: son gratis, también para uso comercial. Si las
  pasás a otra persona, mandá el archivo de licencia con ellas. Para instalarlas en la Mac, doble
  clic en cada `.ttf`.

## Frases

- Línea de marca: **Tuned to 0¢. Priced at 0¢.**
- Qué es, en una oración: *A free plugin that snaps your vocal onto the key, from robot to natural,
  with 2.7 ms of delay while you record.*
- Corta: *Free pitch correction for Mac, Windows and Linux.* Formatos: VST3, Audio Unit (Mac) y LV2 (Linux).
- Links: getsnaptune.com · github.com/NicoFerni/snaptune · ko-fi.com/nicofernandev

## Qué decir y qué no

- Solo lo que se puede probar: está probado en FL Studio; con otros DAWs, "debería andar". Las versiones
  de Linux son nuevas y todavía no se probaron en un DAW de Linux: decilo así.
- Nada de testimonios ni números de usuarios inventados.
- En el video no canta nadie: un sintetizador toca la melodía de la voz de prueba, y el cartel de arriba
  dice "Test melody, synthesized". Si alguien pregunta, decilo así.
- "Auto-Tune" es una marca de Antares; SnapTune no tiene relación con ellos.

## Redes

- **X**: `social/avatar-400.png` de foto de perfil y `social/x-header-1500x500.png` de portada (la de
  3000×1000 es la misma con más resolución). La portada deja libre la esquina de abajo a la izquierda,
  donde X apoya la foto de perfil.
- **Ko-fi**: `social/avatar-1024.png`.
- `social/link-preview-1200x630.png` es la imagen que aparece al compartir getsnaptune.com.

## Video

- `snaptune-promo-1080p.mp4`: 30 s, 1920×1080 a 60 fps, con sonido. Arranca con el problema (la toma
  desafinada) y entra SnapTune en el drop.
- `snaptune-loop.mp4`: 10 s, mudo, en loop; es el de la tapa del sitio. `snaptune-loop-poster.jpg` es
  un cuadro del loop, para usar de miniatura.

## Cómo regenerar

- Capturas del plugin: `cmake --build build --target SnapTuneTests`, después
  `build/SnapTuneTests_artefacts/Release/SnapTuneTests --snapshot salida.png studio 1.0 2` (o `live`).
- Los detalles salen de las capturas del sitio: `cd website && npm run shots` (quedan en
  `website/public/shots/`).
- Video: `cd promo && npm install && npm run render` (promo, queda en `promo/out/`; copialo a
  `brand/video/snaptune-promo-1080p.mp4`) y `npm run loop` (loop de la tapa).
