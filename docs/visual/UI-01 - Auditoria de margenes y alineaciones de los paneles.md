# UI-01 — Auditoría de márgenes y alineaciones de los paneles (#2330)

Revisión visual de los paneles de **administrador**, **funcionario** y **conductor** para encontrar inconsistencias de
márgenes, alineaciones, espaciados y tamaños. Esta tarea solo documenta: las correcciones van en
**UI-02** (estilos compartidos), **UI-03** (panel administrativo) y **UI-04** (funcionario y conductor).

## Cómo se revisó

- Rama `desa` del 17 de noviembre de 2026 (commit `dfa2a9d`), con PostgreSQL y las cuentas de prueba del seed
  (`dev.admin`, `dev.funcionario` y `dev.conductor`).
- Dos anchos: **390 px** (celular) y **1024 px** (computador, con la barra lateral).
- En cada pantalla se midió con JavaScript en el navegador: desborde horizontal, bordes izquierdo y derecho de los
  bloques de contenido, alto, radio y tamaño de letra de los botones, y radio y relleno de las tarjetas. Además se
  revisó una captura de cada pantalla.
- Se contaron los valores distintos de `border-radius`, `font-size` y `padding` en cada hoja de estilos.

Pantallas revisadas: 7 del administrador (Panel, Vans, Choferes, Pasajeros, Viajes, Abrir viaje y Perfil),
3 del funcionario (Reservar, Mis reservas y Perfil) y 5 del conductor (Mis viajes, Detalle del viaje, Historial,
Avisos y Perfil). **Ninguna tiene desborde horizontal** en 390 ni en 1024 px.

## Resumen

1. **No hay una escala común.** Cada hoja de estilos define sus propios radios, letras y rellenos (tabla al final).
   `global.css` solo tiene colores: no hay variables de espaciado, radio ni tamaño de letra.
2. **Los botones no siguen un patrón.** En el panel administrativo hay botones de 24, 25, 29, 31, 33, 39, 41 y 50 px
   de alto, con radios de 6, 8, 9, 14 y 100 px. Varios quedan bajo los 40 px recomendados para tocar en el celular.
3. **Cada pantalla usa un ancho de contenido distinto.** Las listas ocupan todo el ancho, mientras que los formularios,
   el perfil, el detalle y el historial van en una columna centrada de 560 px. Por eso el contenido "salta" de
   posición al cambiar de sección.
4. **Hay textos que se parten o se cortan** en botones y tarjetas angostas.

## Problemas encontrados

Prioridad: **Alta** = se nota en el uso diario o dificulta tocar un control; **Media** = inconsistencia visible;
**Baja** = detalle.

### Administrador (corrige UI-03)

| # | Pantalla | Ubicación | Problema | Prioridad |
|---|---|---|---|---|
| A1 | Vans y Choferes | botones "Editar" y "Dar de baja" de cada tarjeta | Miden 24–25 px de alto: difíciles de tocar en el celular y más bajos que los otros botones del panel. | Alta |
| A2 | Pasajeros | tarjeta de solicitud: `.adm-approve` y `.adm-reject` | "Aprobar" y "Rechazar" van juntos pero tienen distinto alto (31 y 33 px) y distinto estilo: "Aprobar" no tiene `border-radius` y queda con esquinas rectas. | Alta |
| A3 | Viajes (celular) | botón `.adm-open-trip` | "Abrir viaje" se parte en dos líneas al lado de los filtros de fecha y destino. | Alta |
| A4 | Viajes | filtros (chips) | Los 8 filtros ocupan 2 filas en el computador y 3 en el celular, separados de los campos de fecha y destino. | Media |
| A5 | Pasajeros (celular) | filtros de sede y buscador | Los filtros se salen por la derecha ("Ro…") sin ninguna señal de que se pueden deslizar, y el placeholder del buscador se corta ("…sede o dest"). | Media |
| A6 | Abrir viaje y Perfil | `.adm-trip-form`, `.prf` (máx. 560 px, centrados) | Quedan en una columna centrada, mientras Vans, Choferes, Pasajeros y Viajes empiezan pegados a la izquierda (272 px contra 352 px de borde). Tampoco muestran la tarjeta "Hola, Administrador". | Media |
| A7 | Panel | columnas "Próximos viajes" y "Últimas reservas" | En 1024 px el texto se corta con "…" ("18 nov · 17:00 hrs · V…", "Funcionario Apro…"). | Media |
| A8 | Panel | "Ocupación de los próximos viajes" | El título ocupa 2 líneas y queda desalineado con los de las columnas vecinas. | Baja |
| A9 | Viajes | tarjeta de viaje | El título "Quillota 980 → Santiago 14/11/2026" baja la fecha a una segunda línea, y "Abierto por administrador" se parte, así que los botones quedan a distinta altura según la tarjeta. | Media |
| A10 | Pasajeros | campo "Fecha del viaje" | Es más angosto y más bajo que el buscador que tiene encima. | Baja |

### Funcionario (corrige UI-04)

| # | Pantalla | Ubicación | Problema | Prioridad |
|---|---|---|---|---|
| F1 | Mis reservas (computador) | `.psj-reserva__acciones` | "Cancelar reserva" se parte en dos líneas dentro del botón y queda más alto que "Editar reserva". | Alta |
| F2 | Reservar, Mis reservas y Perfil (computador) | `.psj-page` | Tres anchos distintos: el formulario de Reservar y el Perfil van centrados en 560 px, mientras la lista de Mis reservas ocupa todo el ancho. La tarjeta "Hola, Funcionario" llega hasta el borde derecho (0 px de margen) y el formulario de abajo no. | Media |
| F3 | Mis reservas (computador) | `.psj-tabs` (2 columnas de 200 px) | Las pestañas Próximas / Historial ocupan solo la mitad izquierda y no se alinean con las tarjetas de abajo. | Media |
| F4 | Mis reservas | `.psj-tab.is-active` | La pestaña activa se marca con un rectángulo rojo completo; en el resto de la app lo activo se marca con relleno o con subrayado. | Baja |

### Conductor (corrige UI-04; se cruza con la tarea 2899)

| # | Pantalla | Ubicación | Problema | Prioridad |
|---|---|---|---|---|
| C1 | Detalle del viaje (celular) | `.cnd-trayecto` | En la fila de la Ida, la etiqueta "Pendiente" baja a una segunda línea; en la Vuelta queda en la misma línea. | Media |
| C2 | Detalle del viaje | teléfono del pasajero | El enlace del teléfono mide 18 px de alto: difícil de tocar para llamar. | Alta |
| C3 | Mis viajes, Detalle e Historial (computador) | `.psj-page`, `.psj-lista` | Mis viajes ocupa todo el ancho, pero el Detalle y el Historial van en una columna centrada de 560 px. El Historial además no tiene la tarjeta "Hola, Conductor". | Media |
| C4 | Mis viajes | pestañas Próximos / Historial | Repiten la opción "Historial" del menú lateral, que lleva a otra pantalla con otro diseño. | Baja |
| C5 | Detalle del viaje | "Ocupación de la van" | El indicador y su texto quedan alineados a la izquierda, mientras el botón "Iniciar viaje" queda a la derecha, con un espacio vacío entre ambos. | Baja |
| C6 | Historial | tarjetas | La animación de entrada dejó las tarjetas semitransparentes varios segundos. Puede deberse a que el navegador estaba en segundo plano: hay que confirmarlo en UI-05. | Baja |

### Común a los tres paneles (corrige UI-02)

| # | Problema | Prioridad |
|---|---|---|
| G1 | Separación vertical entre bloques de 12, 14, 16 y 17 px según la pantalla. | Media |
| G2 | Tarjetas con radio de 12 o 14 px y relleno de 12, 16 o 18 px según la pantalla. | Media |
| G3 | Botones principales de 42, 48, 50 y 52 px de alto según el panel. | Media |
| G4 | Títulos de tarjeta con 15, 18, 20 o 22 px sin una regla común. | Baja |

## Valores distintos por hoja de estilos

| Archivo | `border-radius` distintos | `font-size` distintos | `padding` distintos | Colores escritos a mano |
|---|---|---|---|---|
| `styles/admin.css` | 11 | 16 (de 8 a 30 px, incluye 10,5 / 12,5 / 13,5 px) | 50 | 28 |
| `styles/pasajero.css` | 12 | 11 | 27 | 42 |
| `styles/conductor.css` | 8 | 9 | 8 | 16 |
| `login/styles/auth.css` | 6 | 13 | 11 | 14 |
| `styles/global.css` | — | — | — | 9 (las únicas variables de color) |

## Correcciones prioritarias

En este orden, para que cada tarea se apoye en la anterior:

1. **UI-02:** agregar a `global.css` variables de espaciado (4, 8, 12, 16, 24 y 32 px), de radio (8, 12 y 999 px)
   y de tamaño de letra, y una clase de botón compartida con alto mínimo de 44 px (normal) y 36 px (compacto).
   Con eso se resuelven G1–G4 y la base de A1, A2 y F1.
2. **UI-02:** definir un solo ancho de contenido por tipo de pantalla: listas a todo el ancho y formularios o
   detalles en 560 px, pero todos alineados al mismo borde izquierdo (resuelve A6, F2 y C3).
3. **UI-03:** botones de las tarjetas de Vans, Choferes y Pasajeros (A1, A2), cabecera de Viajes (A3, A4) y textos
   cortados del Panel (A7, A9).
4. **UI-04:** botones de Mis reservas (F1), pestañas (F3, F4), filas de trayectos y teléfono del conductor (C1, C2).
5. **UI-05:** volver a medir con el mismo método y confirmar C6.

## Limitaciones

- La **selección de asiento** y la **confirmación** del funcionario no se pudieron ver con datos: la cuenta de prueba ya
  tenía reservados todos los viajes abiertos de la base de desarrollo. Hay que revisarlas en UI-04 con un viaje libre.
- La pantalla de **navegación GPS** del conductor solo se abre con un viaje en curso y no se revisó.
