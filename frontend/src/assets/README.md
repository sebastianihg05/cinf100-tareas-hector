# Recursos gráficos

## Símbolo institucional UNAB

| Archivo | Uso |
|---|---|
| `unab-logo.svg` | Versión a color, para fondos claros (blanco o gris claro). |
| `unab-logo-negativo.svg` | Versión en negativo (texto blanco), para fondos oscuros como el login y el registro. |
| `unab-simbolo-negativo.svg` | Solo el escudo, en negativo, para tamaños pequeños sobre fondo oscuro (encabezados de los paneles), donde el texto no se alcanzaría a leer. |

**Procedencia:** extraídos del manual oficial *Logos Sedes / Campus — Universidad Andrés Bello*
(`Logos-sede-campus.pdf`, entregado por la universidad). La versión a color sale de la página 2 y
la de negativo y el escudo solo de la página 3, todas del bloque de la Sede Viña del Mar, quitando
la línea divisoria y la ilustración de la sede.

- Son vectoriales (SVG): se ven nítidos a cualquier tamaño y pesan menos de 10 KB.
- Fondo transparente y proporción original (90 × 75 el logo completo; 45 × 48 el escudo).
- Colores originales del manual: azul `#051C2C` y rojo `#AB192D`.

## Ícono de la pestaña del navegador (#2902)

`frontend/public/favicon.svg` es el escudo a color del mismo `unab-logo.svg`: se copiaron sin cambios los trazos
del escudo (fondo blanco, azul `#051C2C` y rojo `#AB192D`) y solo se ajustó el `viewBox` para que quede cuadrado.
Va en `public/` porque `index.html` lo pide por una ruta fija (`/favicon.svg`), sin pasar por Vite.
El escudo trae su propio fondo blanco, así que se ve igual en pestañas claras y oscuras.

No se deben editar a mano, deformar ni cambiarles los colores. Si hace falta otra versión,
se extrae de nuevo desde el manual.
