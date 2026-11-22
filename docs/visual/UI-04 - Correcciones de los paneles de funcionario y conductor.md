# UI-04 — Correcciones de los paneles de funcionario y conductor (#2333)

Corrección de los problemas del funcionario y del conductor que encontró la auditoría
(`UI-01 - Auditoria de margenes y alineaciones de los paneles.md`), usando las variables de
`UI-02 - Guia de estilos compartidos.md`.

## Funcionario

| # | Problema (UI-01) | Corrección | Medido después |
|---|---|---|---|
| F1 | "Cancelar reserva" se partía en dos líneas y quedaba más alto que "Editar reserva". | Los dos botones reparten el ancho por igual, con el mismo alto y sin partirse (`white-space: nowrap`). | 44 px los dos, 1 línea en 390 y 1024 px |
| F2 | Reservar, Mis reservas y Perfil con tres anchos distintos. | Corregido en #43 (`feature/centrar-vistas`): formularios, perfil y listas van centrados. La franja "Hola, Funcionario" queda a todo el ancho a propósito, como en los otros paneles. | Mismo eje central |
| F3 | Las pestañas Próximas / Historial no se alineaban con las tarjetas de abajo. | Pestañas centradas (#43) y tarjetas de 340 a 420 px, tantas por fila como quepan y centradas aunque sean pocas. Antes una sola tarjeta quedaba a la izquierda. | Pestañas y tarjeta con el mismo margen (190 px por lado en 1024 px) |
| F4 | La pestaña activa se marcaba con un rectángulo rojo. | Se marca con un subrayado rojo de 3 px. | Sin borde lateral |

Además se revisó lo que UI-01 no pudo ver con datos: **selección de asiento** y **confirmación** (Ida y Vuelta) en 390 y
1024 px. Los dos van en la misma columna centrada que el formulario y no tienen desborde.

## Conductor

| # | Problema (UI-01) | Corrección | Medido después |
|---|---|---|---|
| C1 | En los trayectos del día, la etiqueta de estado bajaba de línea en la Ida. | La etiqueta no se encoge y queda siempre en la línea de la Ida/Vuelta; si falta espacio, baja el texto de la hora. | Misma línea en las dos filas (390 px) |
| C2 | El teléfono del pasajero medía 18 px de alto. | Enlace con alto compacto (`--alto-control-compacto`) y subrayado, para que se vea que se puede tocar. | 36 px |
| C3 | Mis viajes a todo el ancho, Historial en 560 px y sin la tarjeta "Hola, Conductor". | El saludo pasa a `components/SaludoConductor.tsx` y lo usan Mis viajes e Historial. El Historial usa el mismo ancho y la misma grilla de tarjetas que Mis viajes (`.psj-ancho-lista`). | Mismas columnas y bordes en las dos pantallas |
| C4 | La pestaña "Historial" de Mis viajes se llamaba igual que la opción "Historial" del menú, que es otra pantalla. | La pestaña se llama "Anteriores" (viajes pasados de cualquier estado); "Historial" del menú sigue mostrando solo los finalizados. | — |
| C5 | La ocupación de la van quedaba a la izquierda y "Iniciar viaje" a la derecha, con un hueco al medio. | "Iniciar viaje" y "Finalizar viaje" ocupan todo el ancho de la tarjeta, bajo la ocupación. | Botón de 524 px en 1024 px y 326 px en 390 px |

C6 (tarjetas semitransparentes del Historial) queda para UI-05.

## Ajuste en las listas del administrador

En #43 las tarjetas del administrador se centraron con una grilla de columnas de 300 a 420 px. Con esa regla caben menos
columnas (2 en vez de 3 en 1280 px). Ahora las listas de los tres paneles usan `flex-wrap` centrado: vuelven las 3 columnas
y la última fila queda al centro.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/styles/pasajero.css` | Botones de la reserva (F1), pestaña activa (F4), tarjetas centradas (F3) y `.psj-ancho-lista`. |
| `frontend/src/styles/conductor.css` | Trayectos del día (C1), teléfono (C2) y botones del detalle (C5). |
| `frontend/src/styles/admin.css` | Listas de tarjetas con `flex-wrap` centrado. |
| `frontend/src/conductor/components/SaludoConductor.tsx` | Nuevo: saludo con la van, compartido. |
| `frontend/src/conductor/pages/ViajesAsignados.tsx` | Usa `SaludoConductor`; pestaña "Anteriores". |
| `frontend/src/conductor/pages/HistorialViajes.tsx` | Usa `SaludoConductor` y el ancho de las listas. |
| `frontend/src/conductor/pages/ViajeDetalle.tsx` | Clase `cnd-detalle__acciones` en los botones de iniciar y finalizar. |

## Verificación

- Medido en el navegador con PostgreSQL y las cuentas `dev.funcionario` y `dev.conductor`, en 390 y 1024 px, más las listas
  del administrador en 1280 px: alto y ancho de los botones, bordes de las tarjetas y desborde horizontal (ninguno).
- Para tener datos se abrió un viaje de prueba con reserva y van asignada, y después se borró.
- Pruebas del frontend: 265 pasan (una nueva: el Historial muestra el saludo). El proyecto compila.
