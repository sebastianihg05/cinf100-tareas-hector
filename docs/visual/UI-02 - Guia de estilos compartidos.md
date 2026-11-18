# UI-02 — Guía de estilos compartidos (#2331)

Criterios comunes de espaciado, radios, tamaños de letra y alturas para los paneles de **administrador**,
**funcionario** y **conductor**. Las reglas viven como variables CSS en `frontend/src/styles/global.css`
y se usan con `var(--nombre)`. Parte de los problemas de `UI-01 - Auditoria de margenes y alineaciones de los paneles.md`.

**Regla general:** en CSS nuevo no se escriben medidas a mano si existe una variable para eso.

## Variables

### Espaciado (múltiplos de 4 px)

| Variable | Valor | Uso |
|---|---|---|
| `--esp-1` | 4 px | Separación mínima (ícono y texto) |
| `--esp-2` | 8 px | Entre chips, filtros o botones de un mismo grupo |
| `--esp-3` | 12 px | Dentro de una tarjeta |
| `--esp-4` | 16 px | Relleno de tarjetas y margen en el celular |
| `--esp-5` | 20 px | Separación entre bloques en el computador |
| `--esp-6` | 24 px | Margen superior del contenido en el computador |
| `--esp-8` | 32 px | Margen lateral del contenido en el computador |

### Variables que cambian solas en el computador (≥ 900 px)

| Variable | Celular | Computador | Uso |
|---|---|---|---|
| `--margen-pagina` | 16 px | 32 px | Margen lateral del contenido (`.adm-content`, `.psj-page`) |
| `--separacion-bloques` | 16 px | 20 px | Entre tarjetas de una lista, filtros, buscador y bloques de página |
| `--relleno-tarjeta` | 16 px | 18 px | Relleno de las tarjetas |

### Radios

| Variable | Valor | Uso |
|---|---|---|
| `--radio-sm` | 8 px | Botones de texto pequeños ("Editar" del perfil) |
| `--radio-control` | 12 px | Botones y campos |
| `--radio-tarjeta` | 14 px | Tarjetas, paneles y recuadros |
| `--radio-pildora` | 999 px | Filtros, insignias y etiquetas redondas |

### Tamaños de letra (sin medios píxeles)

| Variable | Valor | Uso |
|---|---|---|
| `--letra-xs` | 11 px | Etiquetas y textos secundarios de tarjeta |
| `--letra-sm` | 12 px | Ayudas bajo un campo, insignias |
| `--letra-md` | 13 px | Notas y textos de apoyo |
| `--letra-base` | 14 px | Texto normal y botones |
| `--letra-titulo` | 15 px | Título de tarjeta |
| `--letra-lg` | 16 px | Campos de formulario y botón principal |

Los campos de formulario usan **16 px** como mínimo: con menos, Safari de iPhone hace zoom al tocarlos.

### Alturas de controles

| Variable | Valor | Uso |
|---|---|---|
| `--alto-control` | 44 px | Botones y campos normales (mínimo cómodo para tocar con el dedo) |
| `--alto-control-compacto` | 36 px | Botones de texto dentro de una tarjeta |
| `--alto-boton-principal` | 52 px | Botón principal de la pantalla ("Abrir viaje", "Cerrar sesión", "Seleccionar asientos") |

### Otros

| Variable | Valor | Uso |
|---|---|---|
| `--fondo` / `--fondo-escritorio` | `#eef1f5` / `#f6f8fb` | Fondo de la app en celular y en computador |
| `--superficie` | `#fff` | Fondo de tarjetas, campos y paneles |
| `--alerta` | `#ff383c` | Contadores y puntos de aviso |
| `--sombra-tarjeta` | sombra suave | Tarjetas blancas |
| `--ancho-lectura` | 560 px | Formularios, perfil, detalle de viaje y listas de lectura |

## Reglas de diseño

1. **Mismo borde izquierdo en todas las pantallas.** Las listas usan todo el ancho; los formularios, el perfil y los
   detalles van en una columna de `--ancho-lectura`, **alineada a la izquierda** (no centrada). Así el contenido no cambia
   de posición al pasar de una sección a otra.
2. **Botones:** radio `--radio-control` y alto mínimo `--alto-control`; el botón principal de una pantalla usa
   `--alto-boton-principal`.
3. **Tarjetas:** radio `--radio-tarjeta` y relleno `--relleno-tarjeta`. Las tarjetas de una lista se separan con
   `--separacion-bloques`.
4. **Filtros e insignias:** forma de píldora (`--radio-pildora`).

## Qué se cambió en esta tarea

Se aplicaron las variables a los estilos que comparten los paneles:

| Archivo | Estilos |
|---|---|
| `styles/global.css` | Variables nuevas. El fondo de escritorio, que estaba repetido en `admin.css` y `pasajero.css`, quedó en un solo lugar. |
| `styles/admin.css` | `.adm-btn` (botones de los modales, que usan los tres paneles), `.adm-btn--block`, `.adm-field`, `.adm-search`, `.adm-card`, `.adm-list`, `.adm-pills`, `.adm-toolbar`, `.adm-panel`, `.adm-note`, el perfil compartido (`.prf*`), `.adm-trip-form`, los contadores de aviso y los márgenes de `.adm-content`. |
| `styles/pasajero.css` (funcionario y conductor) | `--psj-pad`, `.psj-page`, `.psj-btn`, `.psj-control`, `.psj-card`, `.psj-reserva`, `.psj-lista`, `.psj-badge`, `.psj-segmented__item`, la columna de lectura del escritorio y los textos con medio píxel. |
| `styles/conductor.css` | `.cnd-trayecto`, `.cnd-viaje__hoy`, `.cnd-aviso__titulo`, el botón de centrar el mapa y los textos con medio píxel. |
| `styles/paneles.css` (nuevo) | El encabezado azul y la barra lateral de escritorio, que estaban escritos dos veces casi iguales (`.adm-nav` en `admin.css` y `.psj-nav` en `pasajero.css`). Ahora es una sola regla para los tres paneles. Se carga después de los otros archivos en `main.tsx` para que las reglas de escritorio ganen a las de celular. |

### Resultado medido

- **Mismo borde izquierdo:** en el computador, las 15 pantallas revisadas en UI-01 empiezan en el mismo borde (272 px).
  Antes, "Abrir viaje", los tres perfiles, el detalle del viaje y el historial del conductor empezaban en 352 px.
- **Botones:** los botones principales quedaron en 52 px y los de los modales en 44 px.
- **Medios píxeles:** quedaron en 0. Había 13 tamaños de letra como 10,5, 12,5 o 13,5 px en `admin.css`,
  `pasajero.css` y `conductor.css`.
- **Menos duplicación:** el fondo de escritorio, el rojo de los contadores (que estaba escrito 4 veces), el encabezado
  y la barra lateral quedaron definidos en un solo lugar. Se quitaron 25 líneas repetidas de `admin.css` y
  `pasajero.css`, y la barra lateral se ve igual que antes en los tres paneles.
- **Sin regresiones:** ninguna pantalla se desborda en 390 px y siguen pasando las 255 pruebas del frontend.

## Lo que queda para UI-03 y UI-04

Los estilos propios de cada pantalla todavía tienen medidas escritas a mano: los chips "Editar" y "Dar de baja", los
botones "Aprobar" y "Rechazar", la cabecera de Viajes, las tarjetas del Panel, las acciones de Mis reservas y las filas
de trayectos del conductor. Al corregirlos en UI-03 y UI-04 deben usar estas variables.

`login/styles/auth.css` mantiene su propia paleta oscura (VIS-01) y no se cambió.
